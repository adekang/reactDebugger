/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *
 */

import ReactVersion from "shared/ReactVersion";

import {
  createRequest,
  startWork,
  startFlowing,
  abort,
} from "react-server/src/ReactFizzServer";

import {
  createResponseState,
  createRootFormatContext,
} from "./ReactDOMServerFormatConfig";

// TODO: Move to sub-classing ReadableStream.

function renderToReadableStream(children, options) {
  return new Promise((resolve, reject) => {
    let onFatalError;
    let onAllReady;
    const allReady = new Promise((res, rej) => {
      onAllReady = res;
      onFatalError = rej;
    });

    function onShellReady() {
      const stream = new ReadableStream(
        {
          type: "bytes",
          pull(controller) {
            startFlowing(request, controller);
          },
          cancel(reason) {
            abort(request);
          },
        },
        // $FlowFixMe size() methods are not allowed on byte streams.
        { highWaterMark: 0 },
      );
      // TODO: Move to sub-classing ReadableStream.
      stream.allReady = allReady;
      resolve(stream);
    }
    function onShellError(error) {
      // If the shell errors the caller of `renderToReadableStream` won't have access to `allReady`.
      // However, `allReady` will be rejected by `onFatalError` as well.
      // So we need to catch the duplicate, uncatchable fatal error in `allReady` to prevent a `UnhandledPromiseRejection`.
      allReady.catch(() => {});
      reject(error);
    }
    const request = createRequest(
      children,
      createResponseState(
        options ? options.identifierPrefix : undefined,
        options ? options.nonce : undefined,
        options ? options.bootstrapScriptContent : undefined,
        options ? options.bootstrapScripts : undefined,
        options ? options.bootstrapModules : undefined,
      ),
      createRootFormatContext(options ? options.namespaceURI : undefined),
      options ? options.progressiveChunkSize : undefined,
      options ? options.onError : undefined,
      onAllReady,
      onShellReady,
      onShellError,
      onFatalError,
    );
    if (options && options.signal) {
      const signal = options.signal;
      const listener = () => {
        abort(request, signal.reason);
        signal.removeEventListener("abort", listener);
      };
      signal.addEventListener("abort", listener);
    }
    startWork(request);
  });
}

export { renderToReadableStream, ReactVersion as version };
