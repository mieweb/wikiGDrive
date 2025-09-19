// eslint-disable-next-line import/extensions,import/no-unresolved
import { copy } from '@std/io';
import { ClientRequest } from 'node:http';

export function startDockerProxy(proxyPort = 2375, socketPath= '/var/run/docker.sock'): () => Promise<void> {
  const originalSocketHandler = ClientRequest.prototype.onSocket;
  ClientRequest.prototype.onSocket = function (socket) {
    socket.unref = function () {
      return this;
    };
    return originalSocketHandler.call(this, socket);
  };

  Deno.env.set('DOCKER_HOST', `tcp://localhost:${proxyPort}`);
  const tcpListener = Deno.listen({ port: proxyPort });
  const handleConnections = async () => {
    for await (const tcpConn of tcpListener) {
      dockerProxyHandleConnection(tcpConn, socketPath);
    }
  };

  const connectionsHandler = handleConnections();
  return async () => {
    tcpListener.close();
    ClientRequest.prototype.onSocket = originalSocketHandler;
    await connectionsHandler;
  };
}

async function dockerProxyHandleConnection(tcpConn: Deno.Conn, socketPath: string) {
  let unixConn: Deno.Conn | undefined;
  try {
    unixConn = await Deno.connect({ transport: 'unix', path: socketPath });

    const tcpToUnixPromise = copy(tcpConn, unixConn).catch((err) => {
      if (err.code !== 'EPIPE' && err.code !== 'EINTR') {
        console.error('[TCP -> Unix] error:', err);
      }
    });
    const unixToTcpPromise = copy(unixConn, tcpConn).catch((err) => {
      if (err.code !== 'EPIPE' && err.code !== 'EINTR') {
        console.error('[Unix -> TCP] error:', err);
      }
    });
    await Promise.race([tcpToUnixPromise, unixToTcpPromise]);
  } catch (error) {
    console.error('Docker proxy connection error:', error);
  } finally {
    // Extra safety: ensure connections are closed even if something goes wrong above
    try {
      unixConn?.close();
      tcpConn.close();
    } catch (err) {
      console.log('FATAL: closing connections failed: ', err);
    }
  }
}
