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

function createDrainHandler(destination, request) {
  return () => startFlowing(request, destination);
}

function createAbortHandler(request, reason) {
  return () => abort(request, reason);
}

function createRequestImpl(children, options) {
  return createRequest(
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
    options ? options.onAllReady : undefined,
    options ? options.onShellReady : undefined,
    options ? options.onShellError : undefined,
    undefined,
  );
}

function renderToPipeableStream(children, options) {
  const request = createRequestImpl(children, options);
  let hasStartedFlowing = false;
  startWork(request);
  return {
    pipe(destination) {
      if (hasStartedFlowing) {
        throw new Error(
          "React currently only supports piping to one writable stream.",
        );
      }
      hasStartedFlowing = true;
      startFlowing(request, destination);
      destination.on("drain", createDrainHandler(destination, request));
      destination.on(
        "error",
        createAbortHandler(
          request,
          // eslint-disable-next-line react-internal/prod-error-codes
          new Error("The destination stream errored while writing data."),
        ),
      );
      destination.on(
        "close",
        createAbortHandler(
          request,
          // eslint-disable-next-line react-internal/prod-error-codes
          new Error("The destination stream closed early."),
        ),
      );
      return destination;
    },
    abort(reason) {
      abort(request, reason);
    },
  };
}

export { renderToPipeableStream, ReactVersion as version };
