# Alignement sur 4 octets des entrées non compressées d'un APK (équivalent de zipalign -p 4).
import struct, sys, zipfile

src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
with zipfile.ZipFile(dst, 'w') as zout:
    for info in zin.infolist():
        data = zin.read(info.filename)
        ni = zipfile.ZipInfo(info.filename, date_time=info.date_time)
        ni.compress_type = info.compress_type
        ni.external_attr = info.external_attr
        if ni.compress_type == zipfile.ZIP_STORED:
            off = zout.fp.tell() + 30 + len(ni.filename.encode('utf-8'))
            pad = (4 - (off + 6) % 4) % 4
            ni.extra = struct.pack('<HHH', 0xD935, 2 + pad, 4) + b'\0' * pad
        zout.writestr(ni, data, compress_type=ni.compress_type, compresslevel=9)
