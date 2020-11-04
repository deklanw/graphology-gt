import Graph from "graphology";
import { Buffer } from "buffer/";

const nullOrArrayOfNulls = (v: any) =>
  v === null || (Array.isArray(v) && v[0] === null);

// keeps track of offset and endian
class SmartBuffer {
  offset = 0;
  bigEndian = false;

  constructor(private b: Buffer) {}

  moveOffset = (byteLength: number) => {
    this.offset += byteLength;
    return null;
  };

  setEndian = (bigEndian: boolean) => {
    this.bigEndian = bigEndian;
  };

  toString = (encoding: BufferEncoding, byteLength: number) => {
    const v = this.b.toString(encoding, this.offset, this.offset + byteLength);
    this.offset += byteLength;
    return v;
  };

  // specifically for how gt encodes strings: with the length first then the utf-8 string
  readGTString = () => {
    const byteLength = this.readBigUInt();
    return this.toString("utf-8", byteLength);
  };

  readBool = () => {
    const v = !!this.b.readUInt8(this.offset);
    this.offset += 1;
    return v;
  };

  readDouble = () => {
    const v = this.bigEndian
      ? this.b.readDoubleBE(this.offset)
      : this.b.readDoubleLE(this.offset);
    this.offset += 8;
    return v;
  };

  readInt = (byteLength: number) => {
    const v = this.bigEndian
      ? this.b.readIntBE(this.offset, byteLength)
      : this.b.readIntLE(this.offset, byteLength);
    this.offset += byteLength;
    return v;
  };

  readUInt8 = () => {
    const v = this.b.readUInt8(this.offset);
    this.offset += 1;
    return v;
  };

  readBigUInt = () => {
    const v = this.bigEndian
      ? (this.b as any).readBigUInt64BE(this.offset)
      : (this.b as any).readBigUInt64LE(this.offset);
    this.offset += 8;

    // not handling true bigints
    // catch here?
    return Number(v);
  };

  readBigInt = () => {
    const v = this.bigEndian
      ? (this.b as any).readBigInt64BE(this.offset)
      : (this.b as any).readBigInt64LE(this.offset);
    this.offset += 8;

    // not handling true bigints
    // catch here?
    return Number(v);
  };

  readUInt = (bytes: number) => {
    const v = this.bigEndian
      ? this.b.readUIntBE(this.offset, bytes)
      : this.b.readUIntLE(this.offset, bytes);
    this.offset += bytes;
    return v;
  };

  readVector = <T>(readElement: () => T) => {
    const numElements = this.readBigUInt();

    let a: T[] = [];
    for (let i = 0; i < numElements; i++) {
      a.push(readElement());
    }

    return a;
  };
}

export function parseGT(fileBuffer: Buffer) {
  // casting BigInts to Number in a few places.. if these are actually that large it's doomed. fine for now

  const smartBuffer = new SmartBuffer(fileBuffer);

  const magicString = smartBuffer.toString("utf-8", 6);
  const version = smartBuffer.readUInt8();
  const bigEndian = smartBuffer.readBool();

  smartBuffer.setEndian(bigEndian);

  const commentString = smartBuffer.readGTString();

  const directed = smartBuffer.readBool();

  const graph = new Graph({
    allowSelfLoops: true,
    multi: true,
    type: directed ? "directed" : "undirected",
  });

  const numNodes = smartBuffer.readBigUInt();

  let t0 = performance.now();
  for (let i = 0; i < numNodes; i++) {
    graph.addNode(i);
  }
  let t1 = performance.now();
  console.log(`Adding nodes took ${t1 - t0}`);

  const requiredBits = Math.log2(numNodes);

  const usedBytesForNodeIndex = (() => {
    if (requiredBits <= 8) {
      return 1;
    } else if (requiredBits <= 16) {
      return 2;
    } else if (requiredBits <= 32) {
      return 4;
    } else {
      throw Error("Too many nodes. Not supporting BigInt.");
    }
  })();

  let currentEdgeIndex = 0;

  t0 = performance.now();
  let timeAdding = 0;
  for (let nodeIndex = 0; nodeIndex < numNodes; nodeIndex++) {
    const numNeighbors = smartBuffer.readBigUInt();

    for (let j = 0; j < numNeighbors; j++) {
      let neighbor = smartBuffer.readUInt(usedBytesForNodeIndex);
      let s0 = performance.now();
      graph.addEdgeWithKey(currentEdgeIndex, nodeIndex, neighbor);
      let s1 = performance.now();
      timeAdding += s1 - s0;
      currentEdgeIndex++;
    }
  }

  const numEdges = currentEdgeIndex;

  t1 = performance.now();
  console.log(`Parsing binary and adding edges took total time ${t1 - t0}`);
  console.log(`Just all addEdgeWithKey calls took ${timeAdding}`);

  const numPropMaps = smartBuffer.readBigUInt();

  const getParseTypeFunction = (index: number) => {
    if (index == 0) {
      // bool
      return smartBuffer.readBool;
    } else if (index == 1) {
      // int16
      return () => smartBuffer.readInt(2);
    } else if (index == 2) {
      // int32
      return () => smartBuffer.readInt(4);
    } else if (index == 3) {
      // int64
      return smartBuffer.readBigInt;
    } else if (index == 4) {
      // double
      return smartBuffer.readDouble;
    } else if (index == 5) {
      // long double
      console.warn(`Not supporting long doubles ${index}`);
      return () => smartBuffer.moveOffset(16);
    } else if (index == 6) {
      // string
      return smartBuffer.readGTString;
    } else if (index == 7) {
      // vector bool
      return () => smartBuffer.readVector(smartBuffer.readBool);
    } else if (index == 8) {
      // vector int16
      return () => smartBuffer.readVector(() => smartBuffer.readInt(2));
    } else if (index == 9) {
      // vector int32
      return () => smartBuffer.readVector(() => smartBuffer.readInt(4));
    } else if (index == 10) {
      // vector int64
      return () => smartBuffer.readVector(smartBuffer.readBigInt);
    } else if (index == 11) {
      // vector double
      return () => smartBuffer.readVector(smartBuffer.readDouble);
    } else if (index == 12) {
      // vector long double
      console.warn(`Not supporting long doubles ${index}`);
      return () => smartBuffer.readVector(() => smartBuffer.moveOffset(16));
    } else if (index == 13) {
      // vector string
      return () => smartBuffer.readVector(smartBuffer.readGTString);
    } else if (index == 14) {
      // python object
      console.warn(
        "Found a Python object. Reading as string but it will be useless from JS?"
      );
      return smartBuffer.readGTString;
    } else {
      throw Error(`Unknown prop map value type ${index}`);
    }
  };

  t0 = performance.now();
  for (let i = 0; i < numPropMaps; i++) {
    const keyType = smartBuffer.readUInt8();
    const propertyName = smartBuffer.readGTString();
    const valueType = smartBuffer.readUInt8();

    const parseFunction = getParseTypeFunction(valueType);

    if (keyType == 0) {
      // graph prop
      const v = parseFunction();
      graph.setAttribute(propertyName, v);
    } else if (keyType == 1) {
      // vertex prop
      const vProps = Array.from(Array(numNodes), () => parseFunction());
      const firstElement = vProps[0];

      // if we can't handle this type then first element will be null or an array of nulls. skip that case
      if (!nullOrArrayOfNulls(firstElement)) {
        vProps.forEach((value, i) => {
          graph.setNodeAttribute(i, propertyName, value);
        });
      }
    } else if (keyType == 2) {
      // edge prop
      const eProps = Array.from(Array(numEdges), () => parseFunction());
      const firstElement = eProps[0];

      // if we can't handle this type then first element will be null or an array of nulls. skip that case
      if (!nullOrArrayOfNulls(firstElement)) {
        eProps.forEach((value, i) => {
          graph.setEdgeAttribute(i, propertyName, value);
        });
      }
    } else {
      throw Error("Unknown key type");
    }
  }

  t1 = performance.now();
  console.log(`Adding props took ${t1 - t0}`);

  return graph;
}
