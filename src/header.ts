import { open } from "node:fs/promises";

type Header = {
  pageSize: number;
};

// the first 100 bytes of a database file contain the database header
//
// All multi-byte values are **big-endian**
//
// | Offset | Size | Meaning |
// |-------:|-----:|---------|
// | 0  | 16 | Magic header string: the ASCII `"SQLite format 3"` followed by a NUL byte (`\0`). |
// | 16 | 2  | **Page size** in bytes. Power of two, 512..32768. The value `1` means 65536. |
// | 18 | 1  | File format write version (1 = legacy/rollback journal, 2 = WAL). |
// | 19 | 1  | File format read version (1 or 2). |
// | 20 | 1  | Bytes of unused "reserved" space at the end of each page (usually 0). |
// | 21 | 1  | Maximum embedded payload fraction (must be 64). |
// | 22 | 1  | Minimum embedded payload fraction (must be 32). |
// | 23 | 1  | Leaf payload fraction (must be 32). |
// | 24 | 4  | File change counter. |
// | 28 | 4  | **Size of the database file in pages** ("in-header database size"). |
// | 32 | 4  | Page number of the first freelist trunk page (0 if none). |
// | 36 | 4  | **Total number of freelist pages**. |
// | 40 | 4  | Schema cookie. |
// | 44 | 4  | Schema format number (1..4). |
// | 48 | 4  | Default page cache size. |
// | 52 | 4  | Page number of the largest root b-tree page (auto-vacuum), else 0. |
// | 56 | 4  | Text encoding: 1 = UTF-8, 2 = UTF-16le, 3 = UTF-16be. |
// | 60 | 4  | User version (set by `PRAGMA user_version`). |
// | 64 | 4  | Incremental-vacuum mode flag. |
// | 68 | 4  | Application ID (`PRAGMA application_id`). |
// | 72 | 20 | Reserved for expansion; must be zero. |
// | 92 | 4  | Version-valid-for number. |
// | 96 | 4  | `SQLITE_VERSION_NUMBER` of the library that last wrote the file. |

export const parseHeader = async (filePath: string): Promise<Header> => {
  // get a handle to the file
  const file = await open(filePath, "r");

  // read the first 100 bytes in to a buffer
  const { buffer } = await file.read({
    buffer: Buffer.alloc(100),
    position: 0,
    length: 100,
  });

  // close the file handle
  await file.close();

  // get pageSize from position 16. 16bit integer is 2 bytes. BE denotes
  // big endian - this just indicates which order the bytes should be evaluated in.
  const pageSize = buffer.readUint16BE(16);

  if (pageSize == 1) {
    return { pageSize: 65536 };
  }

  return { pageSize };
};
