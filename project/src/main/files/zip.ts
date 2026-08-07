/**
 * 零依赖 ZIP writer/reader —— F11 备份导出/导入（§5.1，过 G.2 三问：纯 Node 内置）
 * 仅支持 deflate（ZIP 标准默认），UTF-8 文件名。容量：简历 JSON 量级，性能无虞。
 */
import { deflateRawSync, inflateRawSync } from 'node:zlib'

export interface ZipEntry {
  name: string
  data: Buffer
}

const CRC_TABLE = ((): Uint32Array => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** 打包 zip（deflate） */
export function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf-8')
    const crc = crc32(e.data)
    const comp = deflateRawSync(e.data)

    const lfh = Buffer.alloc(30)
    lfh.writeUInt32LE(0x04034b50, 0) // local file header signature
    lfh.writeUInt16LE(20, 4) // version needed
    lfh.writeUInt16LE(0x0800, 6) // UTF-8 names
    lfh.writeUInt16LE(8, 8) // method: deflate
    lfh.writeUInt16LE(0, 10) // mod time
    lfh.writeUInt16LE(0x21, 12) // mod date
    lfh.writeUInt32LE(crc, 14)
    lfh.writeUInt32LE(comp.length, 18)
    lfh.writeUInt32LE(e.data.length, 22)
    lfh.writeUInt16LE(nameBuf.length, 26)
    lfh.writeUInt16LE(0, 28)
    localParts.push(lfh, nameBuf, comp)

    const cdh = Buffer.alloc(46)
    cdh.writeUInt32LE(0x02014b50, 0) // central dir signature
    cdh.writeUInt16LE(20, 4)
    cdh.writeUInt16LE(20, 6)
    cdh.writeUInt16LE(0x0800, 8)
    cdh.writeUInt16LE(8, 10)
    cdh.writeUInt16LE(0, 12)
    cdh.writeUInt16LE(0x21, 14)
    cdh.writeUInt32LE(crc, 16)
    cdh.writeUInt32LE(comp.length, 20)
    cdh.writeUInt32LE(e.data.length, 24)
    cdh.writeUInt16LE(nameBuf.length, 28)
    cdh.writeUInt16LE(0, 30)
    cdh.writeUInt16LE(0, 32)
    cdh.writeUInt16LE(0, 34)
    cdh.writeUInt16LE(0, 36)
    cdh.writeUInt32LE(0, 38)
    cdh.writeUInt32LE(offset, 42)
    centralParts.push(cdh, nameBuf)

    offset += lfh.length + nameBuf.length + comp.length
  }

  const central = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(central.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, central, eocd])
}

interface CentralEntry {
  name: string
  compSize: number
  uncompSize: number
  localOffset: number
}

/** 解析 zip 中央目录（返回条目元数据） */
function readCentralDirectory(buf: Buffer): CentralEntry[] {
  // EOCD 签名 0x06054b50 在尾部 22+ 字节内搜索
  let eocdPos = -1
  const minPos = Math.max(0, buf.length - 22 - 65535)
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdPos = i
      break
    }
  }
  if (eocdPos < 0) throw new Error('not a zip: EOCD not found')
  const centralCount = buf.readUInt16LE(eocdPos + 10)
  const centralOffset = buf.readUInt32LE(eocdPos + 16)

  const entries: CentralEntry[] = []
  let pos = centralOffset
  for (let i = 0; i < centralCount; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('bad central directory')
    const nameLen = buf.readUInt16LE(pos + 28)
    const extraLen = buf.readUInt16LE(pos + 30)
    const commentLen = buf.readUInt16LE(pos + 32)
    const compSize = buf.readUInt32LE(pos + 20)
    const uncompSize = buf.readUInt32LE(pos + 24)
    const localOffset = buf.readUInt32LE(pos + 42)
    const name = buf.subarray(pos + 46, pos + 46 + nameLen).toString('utf-8')
    entries.push({ name, compSize, uncompSize, localOffset })
    pos += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

/** 解包 zip（deflate 条目 → {name,data}） */
export function extractZip(buf: Buffer): ZipEntry[] {
  const entries = readCentralDirectory(buf)
  return entries.map((e) => {
    const lfh = buf.subarray(e.localOffset)
    if (lfh.readUInt32LE(0) !== 0x04034b50) throw new Error('bad local header')
    const nameLen = lfh.readUInt16LE(26)
    const extraLen = lfh.readUInt16LE(28)
    const dataStart = e.localOffset + 30 + nameLen + extraLen
    const comp = buf.subarray(dataStart, dataStart + e.compSize)
    const data = comp.length === e.uncompSize ? comp : inflateRawSync(comp)
    return { name: e.name, data }
  })
}
