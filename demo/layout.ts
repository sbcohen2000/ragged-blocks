import * as rb from "ragged-blocks";
import { WorkerMsg, WorkerReponse } from "./layout-worker-message";

export type RenderSettings = {
  renderDistanceMesh?: boolean;
  renderFragmentBoundingBoxes?: boolean;
};

export type LayoutResult = {
  status: "done";
  algoName: rb.AlgorithmName;
  /**
   * The time it took to perform layout, in milliseconds.
   */
  duration: number;
  svgSrc: string;
} | {
  status: "failed";
  algoName: rb.AlgorithmName;
  error: string;
} | {
  status: "loading";
  algoName: rb.AlgorithmName;
};

/**
 * Construct a promise which resolves after `time` milliseconds. You
 * can use this function to artifically make layout take longer for
 * the purposes of UI testing.
 *
 * @param time The time taken to layout.
 * @returns A promise which resolves after `time` milliseconds.
 */
function wait(time: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, time);
  });
}

export default async function layout<A extends rb.AlgorithmName>(
  layoutTree: rb.LayoutTree<rb.WithMeasurements>,
  algoName: A,
  algoSettings: rb.Settings<A>,
  renderSettings: RenderSettings,
  useWebWorkers?: boolean,
  abortSignal?: AbortSignal
): Promise<LayoutResult> {
  if(window.Worker && useWebWorkers) {
    // Spawn a worker, which will perform layout and render the final
    // SVG.
    const worker = new Worker(new URL("layout-worker.ts", import.meta.url));

    const msg: WorkerMsg<any> = {
      type: "begin",
      layoutTree,
      algoName,
      algoSettings,
      renderSettings
    };

    return new Promise((resolve, reject) => {
      function onAbort() {
        worker.terminate();
        reject("aborted");
      }

      if(abortSignal) {
        abortSignal.addEventListener("abort", onAbort, { once: true });
      }

      worker.onerror = (e) => {
        // Important to prevent default here so that the error does
        // not throw into the outer context, and is instead handled
        // entirely by this function.
        e.preventDefault();

        if(abortSignal) {
          abortSignal.removeEventListener("abort", onAbort);
        }
        worker.terminate();

        if(e instanceof Error) {
          reject(e);
        } else {
          reject(new Error(String(e)));
        }
      }

      worker.onmessage = (e) => {
        if(abortSignal) {
          abortSignal.removeEventListener("abort", onAbort);
        }
        worker.terminate();

        const data: WorkerReponse = e.data;
        if(data.status === "success") {
          resolve({
            status: "done",
            algoName,
            svgSrc: data.svgSrc,
            duration: data.duration
          });
        } else {
          reject(data.error);
        }
      };

      worker.postMessage(msg);
    });
  } else {
    return new Promise(async (resolve, reject) => {
      function onAbort() {
        reject("aborted");
      }

      if(abortSignal) {
        abortSignal.addEventListener("abort", onAbort, { once: true });
      }

      try {
        // *** Debug ***
        // await wait(1000);

        // Just do the work ourselves (synchronously).

        const beginTime = performance.now();

        const metricsIter = rb.eachAtom(layoutTree);
        const algo = rb.constructAlgoByName(algoName)(algoSettings);
        const layoutResult = await algo.layout(layoutTree);
        const text = new (class extends rb.Render {
          render(svg: rb.Svg, _sty: rb.SVGStyle) {
            for(const frag of layoutResult.fragmentsInfo()) {
              const metrics = metricsIter.next().value as rb.Atom<rb.WithMeasurements>;
              const text = svg.text(frag.text);
              text.font("Inconsolata-Medium", 12);
              text.move(frag.rect.left, frag.rect.top - metrics.rect.top);
            }
          }

          boundingBox(): rb.Rect | null {
            return null;
          }
        })();
        let result: rb.Render = layoutResult;

        if(renderSettings.renderDistanceMesh) {
          const mesh = rb.MeshDistanceMesh.fromFragments(layoutResult);
          result = result.stack(mesh);
        }

        if(renderSettings.renderFragmentBoundingBoxes) {
          result = result.stack(new rb.FragmentBoundingBoxesRendering(layoutResult));
        }

        result = result.stack(text);

        const svgSrc = rb.toSVG(result, 10);

        const endTime = performance.now();
        const duration = endTime - beginTime;

        resolve({ status: "done", algoName, svgSrc, duration });
      } catch(e) {
        if(e instanceof Error) {
          reject(e);
        } else {
          reject(new Error(String(e)));
        }
      } finally {
        if(abortSignal) {
          abortSignal.removeEventListener("abort", onAbort);
        }
      }
    });
  }
}
