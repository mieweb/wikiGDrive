'use strict';

import {Writable} from 'stream';

export class BufferWritable extends Writable {
    private buffer: Buffer;

    constructor() {
        super();
        this.buffer = Buffer.alloc(0);
    }

    _write(chunk, encoding, callback) {
        this.buffer = Buffer.concat([ this.buffer, chunk ]);

        callback();
    }

    getBuffer() {
        return this.buffer;
    }

}
