type Varint = {
  value: bigint;
};

// The way to think about this:
//
// When we want to store a number, we need to decide how many bits that number can
// hold. If we always used a 64-bit integer, we'd be taking up 8 bytes on disk even
// if we didn't need seven of those bytes.
//
// Varints solve this by only using as many bytes as needed to store the number.
//
// A varint can store up to 9 bytes. In the first 8 bytes, the first bit is a flag.
// If the value of that flag is 1, it means that the value of the integer
// continues to the next byte. if it's 0, it means that we can stop. So the varint
// is self-describing - it encodes its own algorithm.
//
// The flag is called the "high bit". The rest of the bits are "data bits".
// in each byte, only the data bits contribute to the value of the varint.
// the exception is the last (9th) byte. All of its bits contribute to the value
// of the varint.
//
// Let's take an example - 1011 0010. Let's say that this is the 1st byte.
//
// The value of a bit is calculated by its place. Read docs/reading/varint for more.
//
// We can work through it in reverse order to get the value of this byte
//
// 0 = 0
// 1 = 2
// 0 = 0
// 0 = 0
// 1 = 16
// 1 = 32
// 0 = 0
// 1 = continue
//
// value = 50
//
// Let's now say that the second byte is 0001 0001. The first byte told us to continue.
// So we shift the existing value left by 7 to make room, then add the new byte's
// data bits on the right. Two separate things happen here:
//
// - we mask the high bit of each byte to 0 (1011 0010 -> 0011 0010), so the flag
//   never counts as data. This is what leaves us 7 data bits per byte.
// - we shift the existing value (not the byte) left by 7 to open up 7 empty slots.
//
// The total value becomes:
//
// 1 = 1
// 0 = 0
// 0 = 0
// 0 = 0
// 1 = 16
// 0 = 0
// 0 = 0
// 0 = stop
//
// the shifted "data bits" from the previous byte
// 0 = 0
// 1 = 256
// 0 = 0
// 0 = 0
// 1 = 2048
// 1 = 4096
// 0 = 0
//
// final value: 6417
export const decodeVarint = (bytes: Uint8Array): Varint => {
  let value = BigInt(0);

  for (let i = 0; i < 9; i++) {
    const byte = bytes[i];

    if (byte === undefined) throw new Error("varint: unexpected end of input");

    // the 9th byte is a special case - all of the bits within it are data bits
    if (i === 8) {
      value = shiftAndAdd(value, byte, 8);

      // this is the last byte, so we can return the function
      return { value };
    }

    // for the other bytes, shift and add 7 places
    value = shiftAndAdd(value, byte, 7);

    // finally, check if the high bit is set
    //
    // using bitwise AND is a trick to isolate the first bit. if both bits
    // are 1, return 1, else return 0.
    //
    // 1001 0101 & 1000 0000 == 1000 0000 == 128
    // 0111 0101 & 1000 0000 == 0000 0000 == 0
    //
    // if the value is 0, it means that the high bit is not set. we don't
    // need to continue, so we can return the function.
    if ((byte & 0b1000_0000) === 0) {
      return { value };
    }
  }

  return { value };
};

type Places = 7 | 8;

// << shifts the existing value left to make room (not the byte)
// 0101 1100 becomes 0101 1100 0000 0000
//
// the mask zeroes the high bit of the byte so the flag never counts as data
// (7 places -> mask 0x7f keeps 7 data bits; 8 places -> mask 0xff keeps all 8,
// which is the last byte where every bit is data)
//
// | (bitwise OR) sets a bit to 1 if either side is 1, else 0
// 0101 1100 0000 0000 | 1010 1100 0101 0111 == 1111 1100 0101 0111
//
// together these add the byte's data bits onto the right of the value.
const shiftAndAdd = (value: bigint, byte: number, places: Places) => {
  const mask = places == 7 ? 0b0111_1111 : 0b1111_1111;

  return (value << BigInt(places)) | BigInt(byte & mask);
};
