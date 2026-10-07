import { useState } from 'react';

/**
 * For "Send as image". On Android a page can only be photographed while it is drawn the slow way
 * (a software layer). Keeping it that way all the time makes every scroll and redraw wait for the
 * page, and froze the app on an Android 16 test phone, so the page switches over just for the shot.
 */
export function useCapture() {
  const [capturing, setCapturing] = useState(false);

  async function shoot<R>(action: () => Promise<R>): Promise<R> {
    setCapturing(true);
    // Time for the page to be redrawn in the form that can be photographed.
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      return await action();
    } finally {
      setCapturing(false);
    }
  }

  return { capturing, shoot };
}
