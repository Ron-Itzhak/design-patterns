import { parentPort } from "node:worker_threads";
import { getCount } from "./counter.mjs";

parentPort.postMessage(getCount());
