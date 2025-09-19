import * as rb from "ragged-blocks";
import { WorkerMsg, WorkerReponse } from "./layout-worker-message";

onmessage = async (e: MessageEvent<WorkerMsg<any>>) => {
  const data = e.data;

  if(data.type === "begin") {
    try {
      const beginTime = performance.now();

      const atomsIter = rb.eachAtomWithInheritedStyles(data.layoutTree);
      const algo = rb.constructAlgoByName(data.algoName, data.algoSettings);
      const layoutResult = await algo.layout(data.layoutTree);
      const text = new (class extends rb.Render {
        render(svg: rb.Svg, _sty: rb.SVGStyle) {
          for(const frag of layoutResult.fragmentsInfo()) {
            const atom = atomsIter.next().value as rb.Atom<rb.WithMeasurements<rb.WithStyles>>;
            const text = svg.text(frag.text);
            text.fontFamily("Inconsolata-Medium");
            text.fontSize("12px");
            text.fill(atom.sty.color);
            text.move(frag.rect.left, frag.rect.top - atom.rect.top);
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
