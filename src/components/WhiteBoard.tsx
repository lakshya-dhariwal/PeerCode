//@ts-nocheck
import React, { useLayoutEffect, useState, useRef, useEffect } from "react";
import rough from "roughjs/bundled/rough.cjs.js";
import {
  createElement,
  adjustElementCoordinates,
  cursorForPosition,
  resizedCoordinates,
  midPointBtw,
  getElementAtPosition,
} from "./Element";
import Toolbar from "./Toolbar";
import _ from "lodash";
import { initSocket } from "../utils";

function blob2canvas(canvas, blob) {
  let img = new window.Image();
  img.addEventListener("load", function () {
    canvas.getContext("2d").drawImage(img, 0, 0);
  });
  img.setAttribute("src", blob);
}

const WhiteBoard: React.FC<{
  roomid: string | string[] | undefined;
  userid: number;
}> = ({ roomid, userid }) => {
  const containerRef = useRef(null);
  const socketRef = React.useRef<any>(null);
  const canvasRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [path, setPath] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [elements, setElements] = useState([]);
  const [action, setAction] = useState("none");
  const [toolType, setToolType] = useState("pencil");
  const [selectedElement, setSelectedElement] = useState(null);
  const [colorWidth, setColorWidth] = useState({
    hex: "#32B37A",
    hsv: {},
    rgb: {},
  });
  const [width, setWidth] = useState(1);
  const [shapeWidth, setShapeWidth] = useState(1);
  const [popped, setPopped] = useState(false);

  useEffect(() => {
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    context.lineCap = "round";
    context.lineJoin = "round";

    context.save();

    const drawpath = () => {
      path.forEach((stroke, index) => {
        context.beginPath();

        stroke.forEach((point, i) => {
          context.strokeStyle = point.newColour;
          context.lineWidth = point.newLinewidth;

          var midPoint = midPointBtw(point.clientX, point.clientY);

          context.quadraticCurveTo(
            point.clientX,
            point.clientY,
            midPoint.x,
            midPoint.y
          );
          context.lineTo(point.clientX, point.clientY);
          context.stroke();
        });
        context.closePath();
        context.save();
      });
    };

    if (toolType === "eraser" && popped === true) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      setPopped(false);
    }

    const roughCanvas = rough.canvas(canvas);

    if (path !== undefined) drawpath();

    context.lineWidth = shapeWidth;

    elements.forEach(({ roughElement }) => {
      context.globalAlpha = "1";
      //console.log(roughElement);
      context.strokeStyle = roughElement.options.stroke;
      roughCanvas.draw(roughElement);
    });

    return () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [popped, elements, path, width]);

  const updateElement = (
    index,
    x1,
    y1,
    x2,
    y2,
    toolType,
    strokeWidth,
    strokeColor
  ) => {
    const updatedElement = createElement(
      index,
      x1,
      y1,
      x2,
      y2,
      toolType,
      strokeWidth,
      strokeColor
    );
    const elementsCopy = [...elements];
    elementsCopy[index] = updatedElement;
    setElements(elementsCopy);
  };

  const checkPresent = (clientX, clientY) => {
    if (path === undefined) return;
    var newPath = path;
    path.forEach((stroke, index) => {
      stroke.forEach((point, i) => {
        if (
          clientY < point.clientY + 10 &&
          clientY > point.clientY - 10 &&
          clientX < point.clientX + 10 &&
          clientX > point.clientX - 10
        ) {
          //console.log("Popped");
          newPath.splice(index, 1);
          setPopped(true);
          setPath(newPath);
          return;
        }
      });
    });
    const newElements = elements;
    newElements.forEach((ele, index) => {
      if (
        clientX >= ele.x1 &&
        clientX <= ele.x2 &&
        clientY >= ele.y1 &&
        clientY <= ele.y2
      ) {
        console.log("Popped....");
        newElements.splice(index, 1);
        setPopped(true);
        setElements(newElements);
      }
    });
  };

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");

    if (toolType === "selection") {
      const element = getElementAtPosition(clientX, clientY, elements);
      if (element) {
        const offsetX = clientX - element.x1;
        const offsetY = clientY - element.y1;
        setSelectedElement({ ...element, offsetX, offsetY });
        if (element.position === "inside") {
          setAction("moving");
        } else {
          setAction("resize");
        }
      }
    } else if (toolType === "eraser") {
      setAction("erasing");

      checkPresent(clientX, clientY);
    } else if (toolType === "text") {
    } else {
      const id = elements.length;
      if (toolType === "pencil" || toolType === "brush") {
        setAction("sketching");
        setIsDrawing(true);

        const newColour = colorWidth.hex;
        const newLinewidth = width;
        const transparency = toolType === "brush" ? "0.1" : "1.0";
        const newEle = {
          clientX,
          clientY,
          newColour,
          newLinewidth,
          transparency,
        };
        setPoints((state) => [...state, newEle]);

        context.strokeStyle = newColour;
        context.lineWidth = newLinewidth;
        context.lineCap = 5;
        context.moveTo(clientX, clientY);
        context.beginPath();
      } else {
        setAction("drawing");
        const newColour = colorWidth.hex;
        const newWidth = shapeWidth;
        const element = createElement(
          id,
          clientX,
          clientY,
          clientX,
          clientY,
          toolType,
          newWidth,
          newColour
        );

        setElements((prevState) => [...prevState, element]);
        setSelectedElement(element);
      }
    }
  };

  const handleMouseMove = (e) => {
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    if (toolType === "selection") {
      const element = getElementAtPosition(clientX, clientY, elements);
      e.target.style.cursor = element
        ? cursorForPosition(element.position)
        : "default";
    }
    if (action === "erasing") {
      checkPresent(clientX, clientY);
    }
    if (action === "sketching") {
      if (!isDrawing) return;
      const colour = points[points.length - 1].newColour;
      const linewidth = points[points.length - 1].newLinewidth;
      const transparency = points[points.length - 1].transparency;
      const newEle = { clientX, clientY, colour, linewidth, transparency };

      setPoints((state) => [...state, newEle]);
      var midPoint = midPointBtw(clientX, clientY);
      context.quadraticCurveTo(clientX, clientY, midPoint.x, midPoint.y);
      context.lineTo(clientX, clientY);
      context.stroke();
    } else if (action === "drawing") {
      const index = elements.length - 1;
      const { x1, y1 } = elements[index];
      elements[index].strokeColor = colorWidth.hex;
      elements[index].strokeWidth = shapeWidth;
      updateElement(
        index,
        x1,
        y1,
        clientX,
        clientY,
        toolType,
        shapeWidth,
        colorWidth.hex
      );
    } else if (action === "moving") {
      const {
        id,
        x1,
        x2,
        y1,
        y2,
        type,
        offsetX,
        offsetY,
        shapeWidth,
        strokeColor,
      } = selectedElement;
      const offsetWidth = x2 - x1;
      const offsetHeight = y2 - y1;
      const newX = clientX - offsetX;
      const newY = clientY - offsetY;
      updateElement(
        id,
        newX,
        newY,
        newX + offsetWidth,
        newY + offsetHeight,
        type,
        shapeWidth,
        strokeColor
      );
    } else if (action === "resize") {
      const { id, type, position, ...coordinates } = selectedElement;
      const { x1, y1, x2, y2 } = resizedCoordinates(
        clientX,
        clientY,
        position,
        coordinates
      );
      updateElement(id, x1, y1, x2, y2, type, shapeWidth, colorWidth.hex);
    }
  };
  const handleMouseUp = () => {
    if (action === "resize") {
      const index = selectedElement.id;
      const { id, type, strokeWidth, strokeColor } = elements[index];
      const { x1, y1, x2, y2 } = adjustElementCoordinates(elements[index]);
      updateElement(id, x1, y1, x2, y2, type, strokeWidth, strokeColor);
    } else if (action === "drawing") {
      const index = selectedElement.id;
      const { id, type, strokeWidth } = elements[index];
      const { x1, y1, x2, y2 } = adjustElementCoordinates(elements[index]);
      updateElement(id, x1, y1, x2, y2, type, strokeWidth, colorWidth.hex);
    } else if (action === "sketching") {
      const canvas = document.getElementById("canvas");
      const context = canvas.getContext("2d");
      context.closePath();
      const element = points;
      setPoints([]);
      setPath((prevState) => [...prevState, element]); //tuple
      setIsDrawing(false);
    }
    setAction("none");
  };

  useEffect(() => {
    const emitNewElements = () => {
      console.log("whiteboard draw emit");
      canvasRef.current.toBlob((blob) => {
        return socketRef.current?.emit("draw", {
          room: roomid,
          userid,
          blob,
        });
      });
    };
    const debounced = _.debounce(emitNewElements, 1000);
    debounced();
  }, [elements, path, points]);
  useEffect(() => {
    socketRef.current?.on("draw", (data: any) => {
      if (roomid === data?.room && userid !== data?.userid) {
        const blob = data.blob;
        blob2canvas(canvasRef.current, blob);
      }
    });
  }, [socketRef.current]);

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();
      console.log("whiteboard socket init");
    };
    init();
  }, []);
  return (
    <div className="w-full h-full">
      <div className="bg-grey p-2 px-10 flex justify-between">
        <Toolbar
          toolType={toolType}
          setToolType={setToolType}
          width={width}
          setWidth={setWidth}
          setElements={setElements}
          setColorWidth={setColorWidth}
          setPath={setPath}
          colorWidth={colorWidth}
          setShapeWidth={setShapeWidth}
        />
      </div>
      <div className="grid-bg w-full h-full overflow-hidden" ref={containerRef}>
        <canvas
          id="canvas"
          ref={canvasRef}
          width={window.innerWidth}
          height={window.innerHeight}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={(e) => {
            var touch = e.touches[0];
            handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
          }}
          onTouchMove={(e) => {
            var touch = e.touches[0];
            handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
          }}
          onTouchEnd={handleMouseUp}
        >
          Canvas
        </canvas>
      </div>
    </div>
  );
};

export default WhiteBoard;
