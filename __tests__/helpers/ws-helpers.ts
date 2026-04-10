/**
 * WebSocket test helpers — event-driven utilities.
 *
 * Replaces magic timeouts and polling loops with
 * deterministic, event-driven wait patterns.
 */

/**
 * Wait for a specific event on a WebSocket, with timeout.
 *
 * @param ws - CurlWebSocket instance
 * @param event - Event name ('open', 'message', 'close', 'error')
 * @param timeout - Maximum wait time in ms (default: 5000)
 * @returns Promise resolving with the event data
 */
export function waitForEvent<T = unknown>(
  ws: any,
  event: string,
  timeout = 5000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout (${timeout}ms) waiting for WebSocket event: '${event}'`));
    }, timeout);

    ws.on(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });

    // Auto-reject on error (unless we're waiting for the error event itself)
    if (event !== 'error') {
      ws.on('error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    }
  });
}

/**
 * Connect a WebSocket and wait for the 'open' event.
 *
 * @param ws - CurlWebSocket instance (not yet connected)
 * @param timeout - Maximum wait time in ms
 */
export async function connectAndWait(ws: any, timeout = 5000): Promise<void> {
  const openPromise = waitForEvent(ws, 'open', timeout);
  ws.connect().catch(() => {
    // Error will be caught by the error event handler in waitForEvent
  });
  await openPromise;
}

/**
 * Send a message and wait for the response.
 *
 * @param ws - Connected CurlWebSocket instance
 * @param message - Text or Buffer to send
 * @param timeout - Maximum wait time for response in ms
 * @returns The received message data
 */
export async function sendAndReceive<T = string>(
  ws: any,
  message: string | Buffer,
  timeout = 5000,
): Promise<T> {
  const responsePromise = waitForEvent<T>(ws, 'message', timeout);
  ws.send(message);
  return responsePromise;
}

/**
 * Full round-trip: connect → send → receive → close.
 *
 * @param ws - CurlWebSocket instance (not yet connected)
 * @param message - Text message to echo
 * @param timeout - Timeout per operation
 * @returns The echoed message
 */
export async function echoRoundTrip(
  ws: any,
  message: string,
  timeout = 5000,
): Promise<string> {
  await connectAndWait(ws, timeout);
  const reply = await sendAndReceive<string>(ws, message, timeout);
  ws.close();
  return reply;
}

/**
 * Collect events emitted by a WebSocket during a lifecycle.
 *
 * @param ws - CurlWebSocket instance
 * @param action - Async function to run after attaching listeners
 * @param timeout - Maximum wait time for all events
 * @returns Array of event names in emission order
 */
export async function collectEvents(
  ws: any,
  action: () => Promise<void> | void,
  timeout = 5000,
): Promise<string[]> {
  const events: string[] = [];

  return new Promise<string[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(events); // Return whatever we collected
    }, timeout);

    for (const evt of ['open', 'message', 'close', 'error']) {
      ws.on(evt, () => {
        events.push(evt);
        if (evt === 'close' || evt === 'error') {
          clearTimeout(timer);
          // Small delay to capture any trailing events
          setTimeout(() => resolve(events), 50);
        }
      });
    }

    Promise.resolve(action()).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
