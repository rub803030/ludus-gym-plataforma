"""Verifica la alineacion de 16 KB de las librerias nativas de un APK o AAB.

Uso: python scripts/check-16kb.py ruta/app-release.apk [otro.aab ...]

Google Play exige alineacion ELF de 16 KB en las librerias de 64 bits cuando
targetSdk >= 35. En APK tambien comprueba la alineacion ZIP de las entradas
.sin comprimir. Los AAB no se comprueban por ZIP porque Play genera los APK.
"""
from pathlib import Path
import struct
import sys
import zipfile

PAGE_16KB = 0x4000
ABIS_32 = {"armeabi-v7a", "x86"}


def elf_align(data: bytes) -> int:
    if data[:4] != b"\x7fELF" or data[4] != 2:
        return 0
    endian = "<" if data[5] == 1 else ">"
    phoff = struct.unpack_from(endian + "Q", data, 32)[0]
    phentsize = struct.unpack_from(endian + "H", data, 54)[0]
    phnum = struct.unpack_from(endian + "H", data, 56)[0]
    aligns = []
    for i in range(phnum):
        off = phoff + i * phentsize
        if off + phentsize > len(data):
            break
        if struct.unpack_from(endian + "I", data, off)[0] == 1:  # PT_LOAD
            aligns.append(struct.unpack_from(endian + "Q", data, off + 48)[0])
    return max(aligns, default=0)


def check(path: Path) -> bool:
    ok = True
    found = False
    with zipfile.ZipFile(path) as archive:
        for info in archive.infolist():
            if not info.filename.endswith(".so") or info.is_dir():
                continue
            if any(part in ABIS_32 for part in Path(info.filename).parts):
                continue
            found = True
            align = elf_align(archive.read(info))
            label = path.name + "!" + info.filename
            zip_offset = None
            if path.suffix == ".apk" and info.compress_type == zipfile.ZIP_STORED:
                # zipalign anade relleno en el campo extra de la cabecera local (no en la central).
                with path.open("rb") as archive_file:
                    archive_file.seek(info.header_offset)
                    local = archive_file.read(30)
                name_len = struct.unpack_from("<H", local, 26)[0]
                extra_len = struct.unpack_from("<H", local, 28)[0]
                zip_offset = (info.header_offset + 30 + name_len + extra_len) % PAGE_16KB
            if align < PAGE_16KB:
                print(f"FAIL  {label}: alineacion ELF {align}")
                ok = False
            elif zip_offset:
                print(f"FAIL  {label}: alineacion ZIP {zip_offset}")
                ok = False
            else:
                print(f"OK    {label}: alineacion ELF {align}")
    if not found:
        print(f"OK    {path.name}: sin librerias nativas de 64 bits")
    return ok


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Uso: python scripts/check-16kb.py APK_O_AAB [...]")
    results = [check(Path(arg)) for arg in sys.argv[1:]]
    raise SystemExit(0 if all(results) else 1)
