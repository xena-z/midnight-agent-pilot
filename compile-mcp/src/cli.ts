#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Compiler, createServer, rootFromArgs, VERSION } from './index.js';

const root = rootFromArgs(process.argv.slice(2));
const server = createServer(new Compiler(root, process.env.COMPACT_BIN || 'compact'));
server
  .connect(new StdioServerTransport())
  .then(() => console.error(`compact-compile-mcp ${VERSION}: workspace root ${root}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
