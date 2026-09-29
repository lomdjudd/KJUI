"""Construit un « pack de contexte » compact à donner à Claude, dans un budget de tokens."""
from __future__ import annotations

from typing import Any

from .store import Brain, coverage, est_tokens


def _clip(text: str, max_tokens: int) -> str:
    limit = int(max_tokens * 3.8)
    if len(text) <= limit:
        return text
    cut = text[:limit]
    for sep in ("\n", ". ", " "):
        i = cut.rfind(sep)
        if i > limit * 0.6:
            cut = cut[:i]
            break
    return cut.rstrip() + " […]"


def recall(
    brain: Brain,
    query: str,
    budget: int = 1200,
    limit: int = 8,
    include_pinned: bool = True,
    via: str = "gui",
    exclude_conv: str = "",
    min_cover: float = 0.0,
) -> dict[str, Any]:
    """Retourne {pack, ids, tokens, saved}. Les instructions épinglées passent en premier (max 40 % du budget)."""
    parts: list[str] = []
    ids: list[int] = []
    used = 0
    baseline = 0
    seen: set[int] = set()

    def push(m: dict[str, Any], cap: int) -> bool:
        nonlocal used, baseline
        if m["id"] in seen:
            return False
        room = min(cap, budget - used - 12)
        if room < 40:
            return False
        body = _clip(m["content"], room)
        block = f'#{m["id"]} [{m["kind"]}] {m["title"]}\n{body}'
        used += est_tokens(block) + 2
        baseline += max(m.get("doc_tokens") or 0, m["tokens"])
        parts.append(block)
        ids.append(m["id"])
        seen.add(m["id"])
        return True

    for m in (brain.pinned() if include_pinned else []):
        if used >= budget * 0.4:
            break
        push(m, int(budget * 0.4) - used)
    hits = brain.search(query, limit=limit, exclude_conv=exclude_conv)
    if min_cover:  # mode automatique : ne garde que ce qui recouvre vraiment la question
        def ok(h: dict) -> bool:
            n, tot = coverage(query, f'{h["title"]} {h["tags"]} {h["content"]}')
            return tot > 0 and n >= (2 if tot >= 2 else 1) and n / tot >= min_cover

        hits = [h for h in hits if ok(h)]
    for m in hits:
        push(m, max(120, budget // 3))

    if not parts:
        pack = ""
    else:
        pack = f"<kjui-brain souvenirs={len(parts)}>\n" + "\n---\n".join(parts) + "\n</kjui-brain>"
    served = est_tokens(pack)
    if ids:
        brain.bump(ids, served, baseline)
        brain.log_event("recall", text=query, data={"ids": ids, "tokens": served, "saved": max(0, baseline - served), "via": via})
    return {
        "pack": pack,
        "ids": ids,
        "matches": [m["id"] for m in hits],
        "tokens": served,
        "saved": max(0, baseline - served),
    }
