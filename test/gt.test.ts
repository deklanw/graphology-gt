import fs from "fs";
import parseGT from "../src/";
import { Buffer } from "buffer/";

type TestInfo = {
  name: string;
  numNodes: number;
  numEdges: number;
  directed: boolean;
};

const TEST_CASES: TestInfo[] = [
  {
    name: "zebras",
    numNodes: 27,
    numEdges: 111,
    directed: false,
  },
  {
    name: "polblogs",
    numNodes: 1490,
    numEdges: 19090,
    directed: true,
  },
  {
    name: "celegans",
    numNodes: 6176,
    numEdges: 178151,
    directed: false,
  },
  {
    name: "bitcoin_trust",
    numNodes: 5881,
    numEdges: 35592,
    directed: true,
  },
  {
    name: "us_agencies",
    numNodes: 42951,
    numEdges: 506873,
    directed: true,
  },
];

// const MAGIC_STRING = "⛾ gt";

test("Opens gt", async () => {
  for (const tf of TEST_CASES) {
    console.log(tf.name);
    let path = `assets/${tf.name}.gt`;

    const buffer = fs.readFileSync(path);
    const fileBuffer = Buffer.from(buffer);
    let t0 = performance.now();

    // https://github.com/feross/buffer/pull/274
    // any cast shouldn't be necessary when this is fixed
    let graph = parseGT(fileBuffer as any);
    let t1 = performance.now();
    console.log(`Total time to create graph ${t1 - t0}`);

    expect(graph.order).toEqual(tf.numNodes);
    expect(graph.type).toEqual(tf.directed ? "directed" : "undirected");
    expect(graph.size).toEqual(tf.numEdges);
  }
});
