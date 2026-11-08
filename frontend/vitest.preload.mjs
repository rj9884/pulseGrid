import zlib from "node:zlib";
import { Transform } from "node:stream";

const zlibObj = zlib;

if (typeof zlibObj.createZstdDecompress !== "function") {
  zlibObj.createZstdDecompress = function () {
    return new Transform({
      transform(chunk, encoding, callback) {
        callback(null, chunk);
      },
    });
  };
}

if (!zlibObj.constants) {
  zlibObj.constants = {};
}

if (zlibObj.constants.ZSTD_d_windowLogMax === undefined) {
  zlibObj.constants.ZSTD_d_windowLogMax = 23;
}
