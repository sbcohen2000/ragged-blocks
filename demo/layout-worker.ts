import * as rb from "ragged-blocks";
import { UserData } from "./layout-user-data";
import { WorkerMsg, WorkerReponse } from "./layout-worker-message";

onmessage = async (e: MessageEvent<WorkerMsg>) => {
  const data = e.data;

  if(data.type === "begin") {
    try {
      const beginTime = performance.now();

      const algo: rb.Algorithm<UserData> = rb.constructAlgoByName(data.algoName, data.algoSettings);
      const layoutResult = await algo.layout(data.layoutTree);
      const text = new (class extends rb.Render {
        render(svg: rb.Svg, _sty: rb.SVGStyle) {
          for(const frag of layoutResult.fragmentsInfo()) {
            const text = svg.text(frag.text);
            text.fontFamily("Inconsolata-Medium");
            text.fontSize("12px");
            if(frag.userData) {
              text.fill(frag.userData.sty.color);
              if(frag.userData.sty.fontStyle) {
                text.fontStyle(frag.userData.sty.fontStyle);
              }
            }
            text.move(frag.rect.left, frag.rect.top + (frag.userData?.textBaselineOffset ?? 0));
          }
        }

        boundingBox(): rb.Rect | null {
          return null;
        }
      })();
      let result: rb.Render = layoutResult;

      if(data.renderSettings.renderDistanceMesh) {
        const mesh = rb.MeshDistanceMesh.fromFragments(layoutResult);
        result = result.stack(mesh);
      }

      if(data.renderSettings.renderFragmentBoundingBoxes) {
        result = result.stack(new rb.FragmentBoundingBoxesRendering(layoutResult));
      }

      result = result.stack(text);

      const svgSrc = rb.toSVG(result, 10);

      const endTime = performance.now();
      const duration = endTime - beginTime;

      const msg: WorkerReponse = {
        status: "success",
        duration,
        svgSrc
      };
      postMessage(msg);

    } catch(e) {
      console.error(e);
      if(e instanceof Error) {
        const msg: WorkerReponse = {
          status: "failure",
          error: e
        };
        postMessage(msg);
      } else {
        const msg: WorkerReponse = {
          status: "failure",
          error: new Error(String(e))
        };
        postMessage(msg);
      }
    }
  }
};
