export interface GraphNode {
  id: string;
  x: number;
  y: number;
  label: string;
  isStart?: boolean;
  isEnd?: boolean;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
  direction: 'forward' | 'backward' | 'bidirectional';
}

export interface AlgorithmStep {
  type: string;
  message: string;
  distances?: Record<string, number> | number[][];
  fScore?: Record<string, number>;
  current?: string;
  updated?: string;
  visited?: string[];
  closedSet?: string[];
  edge?: string;
  iteration?: number;
  intermediate?: string;
  nodes?: string[];
  path?: string[] | null;
  distance?: number;
}

export interface AlgorithmResult {
  path: string[];
  distance: number;
  algorithm: string;
  steps: AlgorithmStep[];
}

export class GraphAlgorithms {
  /**
   * Dijkstra algorithm with step-by-step visualization
   */
  static async dijkstra(
    nodes: GraphNode[],
    edges: GraphEdge[],
    start: string,
    end: string,
    onStep?: (step: AlgorithmStep) => Promise<void>
  ): Promise<AlgorithmResult> {
    const distances: Record<string, number> = {};
    const previous: Record<string, string | null> = {};
    const unvisited = new Set<string>();
    const steps: AlgorithmStep[] = [];

    // Initialize
    nodes.forEach(node => {
      distances[node.id] = Infinity;
      previous[node.id] = null;
      unvisited.add(node.id);
    });
    distances[start] = 0;

    const initStep: AlgorithmStep = {
      type: 'init',
      message: `Bước 1 - Khởi tạo: Đặt khoảng cách của node bắt đầu ${start} = 0 (vì đây là điểm xuất phát), tất cả các node khác = ∞ (chưa biết khoảng cách). Tạo tập hợp các node chưa được xét (unvisited set).`,
      distances: { ...distances },
      current: start,
      nodes: nodes.map(n => n.id)
    };
    steps.push(initStep);
    if (onStep) await onStep(initStep);

    while (unvisited.size > 0) {
      // Find unvisited node with smallest distance
      let current: string | null = null;
      let minDistance = Infinity;
      
      unvisited.forEach(nodeId => {
        if (distances[nodeId] < minDistance) {
          minDistance = distances[nodeId];
          current = nodeId;
        }
      });

      if (current === null || distances[current] === Infinity) break;
      if (current === end) break;

      unvisited.delete(current);

      const visitStep: AlgorithmStep = {
        type: 'visit',
        message: `Bước ${steps.length} - Chọn node: Tìm node có khoảng cách nhỏ nhất trong tập unvisited. Chọn node ${current} với khoảng cách = ${distances[current]}. Đánh dấu node này đã được xét (xóa khỏi unvisited set).`,
        distances: { ...distances },
        current: current,
        visited: Array.from(unvisited),
        nodes: nodes.map(n => n.id)
      };
      steps.push(visitStep);
      if (onStep) await onStep(visitStep);

      // Update neighbors
      for (const edge of edges) {
        let neighbor: string | null = null;
        let edgeWeight = edge.weight;

        if (edge.from === current && (edge.direction === 'forward' || edge.direction === 'bidirectional')) {
          neighbor = edge.to;
        } else if (edge.to === current && (edge.direction === 'backward' || edge.direction === 'bidirectional')) {
          neighbor = edge.from;
        }

        if (neighbor && unvisited.has(neighbor) && current !== null) {
          const alt = distances[current] + edgeWeight;
          if (alt < distances[neighbor]) {
            distances[neighbor] = alt;
            previous[neighbor] = current;

            const updateStep: AlgorithmStep = {
              type: 'update',
              message: `Bước ${steps.length + 1} - Cập nhật khoảng cách: Xét cạnh từ ${current} đến ${neighbor} với trọng số ${edgeWeight}. Tính khoảng cách mới: ${neighbor} = khoảng cách đến ${current} (${distances[current]}) + trọng số cạnh (${edgeWeight}) = ${alt}. Nếu khoảng cách mới nhỏ hơn khoảng cách hiện tại của ${neighbor}, cập nhật khoảng cách và lưu ${current} là node trước đó của ${neighbor} để sau này truy vết đường đi.`,
              distances: { ...distances },
              current: current,
              updated: neighbor,
              edge: edge.id,
              nodes: nodes.map(n => n.id)
            };
            steps.push(updateStep);
            if (onStep) await onStep(updateStep);
          }
        }
      }
    }

    // Reconstruct path
    if (distances[end] === Infinity) {
      const resultStep: AlgorithmStep = {
        type: 'result',
        message: 'Không tìm thấy đường đi từ Start đến End',
        path: null
      };
      steps.push(resultStep);
      if (onStep) await onStep(resultStep);
      return {
        path: [],
        distance: Infinity,
        algorithm: 'Dijkstra',
        steps
      };
    }

    const path: string[] = [];
    let current: string | null = end;
    while (current !== null) {
      path.unshift(current);
      current = previous[current] || null;
    }

    const resultStep: AlgorithmStep = {
      type: 'result',
      message: `Kết quả cuối cùng - Truy vết đường đi: Bắt đầu từ node đích ${end}, truy ngược lại theo các node trước đó (previous) để tìm đường đi ngắn nhất. Đường đi tìm được: ${path.join(' → ')} với tổng khoảng cách = ${distances[end]}. Thuật toán Dijkstra đảm bảo tìm được đường đi ngắn nhất vì mỗi lần chọn node có khoảng cách nhỏ nhất, khoảng cách đó đã là tối ưu.`,
      path: path,
      distance: distances[end]
    };
    steps.push(resultStep);
    if (onStep) await onStep(resultStep);

    return {
      path,
      distance: distances[end],
      algorithm: 'Dijkstra',
      steps
    };
  }

  /**
   * Bellman-Ford algorithm with step-by-step visualization
   */
  static async bellmanFord(
    nodes: GraphNode[],
    edges: GraphEdge[],
    start: string,
    end: string,
    onStep?: (step: AlgorithmStep) => Promise<void>
  ): Promise<AlgorithmResult> {
    const distances: Record<string, number> = {};
    const previous: Record<string, string | null> = {};
    const steps: AlgorithmStep[] = [];

    // Initialize
    nodes.forEach(node => {
      distances[node.id] = Infinity;
      previous[node.id] = null;
    });
    distances[start] = 0;

    const initStep: AlgorithmStep = {
      type: 'init',
      message: `Bước 1 - Khởi tạo Bellman-Ford: Đặt khoảng cách của node bắt đầu ${start} = 0 (điểm xuất phát), tất cả các node khác = ∞ (chưa biết khoảng cách). Thuật toán Bellman-Ford sẽ lặp lại việc "relax" (nới lỏng) các cạnh (V-1) lần, trong đó V là số lượng node.`,
      distances: { ...distances },
      iteration: 0,
      nodes: nodes.map(n => n.id)
    };
    steps.push(initStep);
    if (onStep) await onStep(initStep);

    // Relax edges V-1 times
    for (let i = 0; i < nodes.length - 1; i++) {
      const iterationStep: AlgorithmStep = {
        type: 'iteration',
        message: `Bước ${i + 2} - Lần lặp ${i + 1}/${nodes.length - 1}: Bắt đầu lần lặp thứ ${i + 1}. Trong mỗi lần lặp, ta sẽ xét tất cả các cạnh trong đồ thị và thực hiện "relax" (nới lỏng): nếu khoảng cách đến node đích có thể được cải thiện bằng cách đi qua node nguồn, ta sẽ cập nhật khoảng cách.`,
        distances: { ...distances },
        iteration: i + 1,
        nodes: nodes.map(n => n.id)
      };
      steps.push(iterationStep);
      if (onStep) await onStep(iterationStep);

      for (const edge of edges) {
        const from = edge.from;
        const to = edge.to;

        // Forward edge
        if (edge.direction === 'forward' || edge.direction === 'bidirectional') {
          if (distances[from] !== Infinity && distances[from] + edge.weight < distances[to]) {
            distances[to] = distances[from] + edge.weight;
            previous[to] = from;

            const relaxStep: AlgorithmStep = {
              type: 'relax',
              message: `Relax cạnh ${from} → ${to}: Kiểm tra nếu khoảng cách đến ${from} (${distances[from]}) + trọng số cạnh (${edge.weight}) < khoảng cách hiện tại đến ${to} (${distances[to]}). Điều kiện đúng, nên cập nhật: khoảng cách đến ${to} = ${distances[from]} + ${edge.weight} = ${distances[to]}. Lưu ${from} là node trước đó của ${to} để truy vết.`,
              distances: { ...distances },
              edge: edge.id,
              updated: to,
              nodes: nodes.map(n => n.id)
            };
            steps.push(relaxStep);
            if (onStep) await onStep(relaxStep);
          }
        }

        // Backward edge
        if (edge.direction === 'backward' || edge.direction === 'bidirectional') {
          if (distances[to] !== Infinity && distances[to] + edge.weight < distances[from]) {
            distances[from] = distances[to] + edge.weight;
            previous[from] = to;

            const relaxStep: AlgorithmStep = {
              type: 'relax',
              message: `Relax ${to} → ${from}: ${from} = ${to} + ${edge.weight} = ${distances[from]}`,
              distances: { ...distances },
              edge: edge.id,
              updated: from,
              nodes: nodes.map(n => n.id)
            };
            steps.push(relaxStep);
            if (onStep) await onStep(relaxStep);
          }
        }
      }
    }

    if (distances[end] === Infinity) {
      const resultStep: AlgorithmStep = {
        type: 'result',
        message: 'Không tìm thấy đường đi',
        path: null
      };
      steps.push(resultStep);
      if (onStep) await onStep(resultStep);
      return {
        path: [],
        distance: Infinity,
        algorithm: 'Bellman-Ford',
        steps
      };
    }

    const path: string[] = [];
    let current: string | null = end;
    while (current !== null) {
      path.unshift(current);
      current = previous[current] || null;
    }

    const resultStep: AlgorithmStep = {
      type: 'result',
      message: `Kết quả cuối cùng - Truy vết đường đi: Sau ${nodes.length - 1} lần lặp, thuật toán Bellman-Ford đã tìm được khoảng cách ngắn nhất từ ${start} đến ${end}. Truy ngược lại từ node đích theo các node trước đó để tìm đường đi. Đường đi: ${path.join(' → ')} với tổng khoảng cách = ${distances[end]}. Lưu ý: Bellman-Ford có thể xử lý đồ thị có cạnh trọng số âm (nhưng không có chu trình âm).`,
      path: path,
      distance: distances[end]
    };
    steps.push(resultStep);
    if (onStep) await onStep(resultStep);

    return {
      path,
      distance: distances[end],
      algorithm: 'Bellman-Ford',
      steps
    };
  }

  /**
   * Floyd-Warshall algorithm with step-by-step visualization
   */
  static async floydWarshall(
    nodes: GraphNode[],
    edges: GraphEdge[],
    start: string,
    end: string,
    onStep?: (step: AlgorithmStep) => Promise<void>
  ): Promise<AlgorithmResult> {
    const n = nodes.length;
    const nodeIds = nodes.map(n => n.id);
    const dist: number[][] = [];
    const next: (string | null)[][] = [];
    const steps: AlgorithmStep[] = [];

    for (let i = 0; i < n; i++) {
      dist[i] = [];
      next[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          dist[i][j] = 0;
        } else {
          dist[i][j] = Infinity;
        }
        next[i][j] = null;
      }
    }

    // Set initial distances
    edges.forEach(edge => {
      const i = nodeIds.indexOf(edge.from);
      const j = nodeIds.indexOf(edge.to);
      if (edge.direction === 'forward' || edge.direction === 'bidirectional') {
        if (i >= 0 && j >= 0 && edge.weight < dist[i][j]) {
          dist[i][j] = edge.weight;
          next[i][j] = edge.to;
        }
      }
      if (edge.direction === 'backward' || edge.direction === 'bidirectional') {
        if (i >= 0 && j >= 0 && edge.weight < dist[j][i]) {
          dist[j][i] = edge.weight;
          next[j][i] = edge.from;
        }
      }
    });

    const initStep: AlgorithmStep = {
      type: 'init',
      message: `Bước 1 - Khởi tạo ma trận khoảng cách: Tạo ma trận dist[V][V] với V là số node. Khởi tạo: dist[i][i] = 0 (khoảng cách từ node đến chính nó), dist[i][j] = ∞ (chưa biết khoảng cách) nếu i ≠ j. Sau đó, với mỗi cạnh từ u đến v có trọng số w, đặt dist[u][v] = w. Ma trận này sẽ lưu khoảng cách ngắn nhất giữa mọi cặp node.`,
      distances: dist.map(row => [...row]),
      nodes: nodeIds
    };
    steps.push(initStep);
    if (onStep) await onStep(initStep);

    // Floyd-Warshall algorithm
    for (let k = 0; k < n; k++) {
      const iterationStep: AlgorithmStep = {
        type: 'iteration',
        message: `Bước ${k + 2} - Xét node trung gian ${nodeIds[k]} (k = ${k + 1}/${n}): Với mỗi node trung gian k, ta kiểm tra xem có thể cải thiện khoảng cách giữa mọi cặp node (i, j) bằng cách đi qua k không. Công thức: dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j]). Nghĩa là: khoảng cách từ i đến j có thể được cải thiện bằng cách đi từ i → k → j.`,
        intermediate: nodeIds[k],
        iteration: k + 1,
        distances: dist.map(row => [...row]),
        nodes: nodeIds
      };
      steps.push(iterationStep);
      if (onStep) await onStep(iterationStep);

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (dist[i][k] !== Infinity && dist[k][j] !== Infinity) {
            if (dist[i][k] + dist[k][j] < dist[i][j]) {
              dist[i][j] = dist[i][k] + dist[k][j];
              next[i][j] = next[i][k];
            }
          }
        }
      }
    }

    const startIdx = nodeIds.indexOf(start);
    const endIdx = nodeIds.indexOf(end);

    if (dist[startIdx][endIdx] === Infinity) {
      const resultStep: AlgorithmStep = {
        type: 'result',
        message: 'Không tìm thấy đường đi',
        path: null
      };
      steps.push(resultStep);
      if (onStep) await onStep(resultStep);
      return {
        path: [],
        distance: Infinity,
        algorithm: 'Floyd-Warshall',
        steps
      };
    }

    const path: string[] = [];
    let current: string | null = start;
    while (current !== null && current !== end) {
      path.push(current);
      const currentIdx = nodeIds.indexOf(current);
      current = next[currentIdx][endIdx];
    }
    if (current === end) {
      path.push(end);
    }

    const resultStep: AlgorithmStep = {
      type: 'result',
      message: `Kết quả cuối cùng - Truy vết đường đi: Sau khi xét tất cả các node trung gian, ma trận dist chứa khoảng cách ngắn nhất giữa mọi cặp node. Để tìm đường đi từ ${start} đến ${end}, sử dụng ma trận next để truy vết. Đường đi: ${path.join(' → ')} với tổng khoảng cách = ${dist[startIdx][endIdx]}. Thuật toán Floyd-Warshall tìm khoảng cách ngắn nhất giữa TẤT CẢ các cặp node trong một lần chạy.`,
      path: path,
      distance: dist[startIdx][endIdx]
    };
    steps.push(resultStep);
    if (onStep) await onStep(resultStep);

    return {
      path,
      distance: dist[startIdx][endIdx],
      algorithm: 'Floyd-Warshall',
      steps
    };
  }

  /**
   * A* algorithm with step-by-step visualization
   */
  static async aStar(
    nodes: GraphNode[],
    edges: GraphEdge[],
    start: string,
    end: string,
    onStep?: (step: AlgorithmStep) => Promise<void>
  ): Promise<AlgorithmResult> {
    const startNode = nodes.find(n => n.id === start);
    const endNode = nodes.find(n => n.id === end);
    const steps: AlgorithmStep[] = [];
    
    if (!startNode || !endNode) {
      return {
        path: [],
        distance: Infinity,
        algorithm: 'A*',
        steps
      };
    }

    const heuristic = (nodeId: string): number => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return Infinity;
      const dx = node.x - endNode.x;
      const dy = node.y - endNode.y;
      return Math.sqrt(dx * dx + dy * dy) / 10;
    };

    const openSet = new Set<string>([start]);
    const closedSet = new Set<string>();
    const gScore: Record<string, number> = {};
    const fScore: Record<string, number> = {};
    const cameFrom: Record<string, string | null> = {};

    nodes.forEach(node => {
      gScore[node.id] = Infinity;
      fScore[node.id] = Infinity;
      cameFrom[node.id] = null;
    });

    gScore[start] = 0;
    fScore[start] = heuristic(start);

    const initStep: AlgorithmStep = {
      type: 'init',
      message: `Bước 1 - Khởi tạo A*: A* sử dụng hàm đánh giá f(n) = g(n) + h(n), trong đó g(n) là khoảng cách thực tế từ node bắt đầu đến n, h(n) là hàm heuristic (ước tính khoảng cách từ n đến đích). Khởi tạo: g(${start}) = 0 (khoảng cách từ điểm xuất phát), h(${start}) = ${fScore[start].toFixed(2)} (ước tính khoảng cách đến đích dựa trên tọa độ), f(${start}) = g + h = ${fScore[start].toFixed(2)}. Tạo openSet chứa node bắt đầu, closedSet rỗng.`,
      distances: { ...gScore },
      fScore: { ...fScore },
      nodes: nodes.map(n => n.id)
    };
    steps.push(initStep);
    if (onStep) await onStep(initStep);

    while (openSet.size > 0) {
      let current: string | null = null;
      let minF = Infinity;
      
      openSet.forEach(nodeId => {
        if (fScore[nodeId] < minF) {
          minF = fScore[nodeId];
          current = nodeId;
        }
      });

      if (current === null) break;
      if (current === end) {
        const path: string[] = [];
        let node: string | null = end;
        while (node !== null) {
          path.unshift(node);
          node = cameFrom[node] || null;
        }
        
        const resultStep: AlgorithmStep = {
          type: 'result',
          message: `Kết quả cuối cùng - Truy vết đường đi: Đã tìm thấy node đích ${end}. Truy ngược lại từ node đích theo các node trước đó (cameFrom) để tìm đường đi. Đường đi: ${path.join(' → ')} với tổng khoảng cách thực tế = ${gScore[end].toFixed(2)}. A* đảm bảo tìm được đường đi ngắn nhất nếu hàm heuristic h(n) là "admissible" (không bao giờ đánh giá quá cao khoảng cách thực tế).`,
          path: path,
          distance: gScore[end]
        };
        steps.push(resultStep);
        if (onStep) await onStep(resultStep);
        
        return {
          path,
          distance: gScore[end],
          algorithm: 'A*',
          steps
        };
      }

      openSet.delete(current);
      closedSet.add(current);

      const visitStep: AlgorithmStep = {
        type: 'visit',
        message: `Bước ${steps.length + 1} - Chọn node: Tìm node trong openSet có f(n) nhỏ nhất. Chọn node ${current} với g = ${gScore[current].toFixed(2)} (khoảng cách thực tế), f = ${fScore[current].toFixed(2)} (g + h). Xóa node này khỏi openSet và thêm vào closedSet (đã xét xong). Nếu node này là đích, ta đã tìm thấy đường đi ngắn nhất.`,
        current: current,
        distances: { ...gScore },
        fScore: { ...fScore },
        closedSet: Array.from(closedSet),
        nodes: nodes.map(n => n.id)
      };
      steps.push(visitStep);
      if (onStep) await onStep(visitStep);

      for (const edge of edges) {
        let neighbor: string | null = null;
        let edgeWeight = edge.weight;

        if (edge.from === current && (edge.direction === 'forward' || edge.direction === 'bidirectional')) {
          neighbor = edge.to;
        } else if (edge.to === current && (edge.direction === 'backward' || edge.direction === 'bidirectional')) {
          neighbor = edge.from;
        }

        if (!neighbor || closedSet.has(neighbor) || current === null) continue;

        const tentativeGScore = gScore[current] + edgeWeight;

        if (!openSet.has(neighbor)) {
          openSet.add(neighbor);
        } else if (tentativeGScore >= gScore[neighbor]) {
          continue;
        }

        cameFrom[neighbor] = current;
        gScore[neighbor] = tentativeGScore;
        fScore[neighbor] = gScore[neighbor] + heuristic(neighbor);

        const updateStep: AlgorithmStep = {
          type: 'update',
          message: `Cập nhật node lân cận ${neighbor}: Xét cạnh từ ${current} đến ${neighbor} với trọng số ${edge.weight}. Tính gScore mới: g(${neighbor}) = g(${current}) + trọng số = ${gScore[neighbor].toFixed(2)}. Tính hScore (heuristic): h(${neighbor}) = khoảng cách ước tính từ ${neighbor} đến đích = ${(fScore[neighbor] - gScore[neighbor]).toFixed(2)}. Tính fScore: f(${neighbor}) = g + h = ${fScore[neighbor].toFixed(2)}. Nếu node chưa có trong openSet, thêm vào. Lưu ${current} là node trước đó của ${neighbor}.`,
          updated: neighbor,
          distances: { ...gScore },
          fScore: { ...fScore },
          edge: edge.id,
          nodes: nodes.map(n => n.id)
        };
        steps.push(updateStep);
        if (onStep) await onStep(updateStep);
      }
    }

    const resultStep: AlgorithmStep = {
      type: 'result',
      message: 'Không tìm thấy đường đi',
      path: null
    };
    steps.push(resultStep);
    if (onStep) await onStep(resultStep);

    return {
      path: [],
      distance: Infinity,
      algorithm: 'A*',
      steps
    };
  }

  /**
   * Graph Coloring (Greedy Coloring Algorithm)
   * Tô màu đồ thị: Tìm cách tô màu các đỉnh sao cho không có hai đỉnh kề nhau có cùng màu
   */
  static async graphColoring(
    nodes: GraphNode[],
    edges: GraphEdge[],
    onStep?: (step: AlgorithmStep) => Promise<void>
  ): Promise<{ colors: Record<string, number>; chromaticNumber: number; steps: AlgorithmStep[] }> {
    const steps: AlgorithmStep[] = [];
    const colors: Record<string, number> = {};
    const usedColors = new Set<number>();

    const initStep: AlgorithmStep = {
      type: 'init',
      message: `Bước 1 - Khởi tạo thuật toán tô màu đồ thị (Graph Coloring): Mục tiêu là tô màu các đỉnh sao cho không có hai đỉnh kề nhau có cùng màu. Sử dụng thuật toán Greedy: duyệt từng đỉnh, tìm màu nhỏ nhất chưa được sử dụng bởi các đỉnh kề. Khởi tạo: tất cả đỉnh chưa có màu (màu = -1).`,
      nodes: nodes.map(n => n.id)
    };
    steps.push(initStep);
    if (onStep) await onStep(initStep);

    // For each node, find the smallest color not used by neighbors
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const neighborColors = new Set<number>();

      // Find all neighbor colors
      for (const edge of edges) {
        let neighbor: string | null = null;
        if (edge.from === node.id && (edge.direction === 'forward' || edge.direction === 'bidirectional')) {
          neighbor = edge.to;
        } else if (edge.to === node.id && (edge.direction === 'backward' || edge.direction === 'bidirectional')) {
          neighbor = edge.from;
        }

        if (neighbor && colors[neighbor] !== undefined) {
          neighborColors.add(colors[neighbor]);
        }
      }

      // Find smallest available color
      let color = 0;
      while (neighborColors.has(color)) {
        color++;
      }

      colors[node.id] = color;
      usedColors.add(color);

      const colorStep: AlgorithmStep = {
        type: 'update',
        message: `Bước ${i + 2} - Tô màu đỉnh ${node.id}: Xét các đỉnh kề của ${node.id}, các màu đã được sử dụng là: ${Array.from(neighborColors).join(', ') || 'không có'}. Chọn màu nhỏ nhất chưa được sử dụng = ${color}. Tô đỉnh ${node.id} bằng màu ${color}.`,
        current: node.id,
        nodes: nodes.map(n => n.id)
      };
      steps.push(colorStep);
      if (onStep) await onStep(colorStep);
    }

    const resultStep: AlgorithmStep = {
      type: 'result',
      message: `Kết quả cuối cùng: Đã tô màu tất cả các đỉnh. Số màu tối thiểu cần dùng (số sắc tố - Chromatic Number) = ${usedColors.size}. Màu của từng đỉnh: ${Object.entries(colors).map(([id, c]) => `${id}: màu ${c}`).join(', ')}. Ứng dụng: Lập lịch thi, phân bổ tài nguyên, đăng ký tần số radio.`,
      nodes: nodes.map(n => n.id)
    };
    steps.push(resultStep);
    if (onStep) await onStep(resultStep);

    return {
      colors,
      chromaticNumber: usedColors.size,
      steps
    };
  }

  /**
   * Breadth-First Search (BFS)
   * Tìm kiếm theo chiều rộng: Duyệt đồ thị theo từng lớp, từ gần đến xa
   */
  static async bfs(
    nodes: GraphNode[],
    edges: GraphEdge[],
    start: string,
    onStep?: (step: AlgorithmStep) => Promise<void>
  ): Promise<{ visited: string[]; order: string[]; steps: AlgorithmStep[] }> {
    const steps: AlgorithmStep[] = [];
    const visited = new Set<string>();
    const queue: string[] = [start];
    const order: string[] = [];
    const parent: Record<string, string | null> = { [start]: null };

    const initStep: AlgorithmStep = {
      type: 'init',
      message: `Bước 1 - Khởi tạo BFS (Breadth-First Search - Tìm kiếm theo chiều rộng): BFS duyệt đồ thị theo từng lớp, từ gần đến xa. Sử dụng hàng đợi (queue) để lưu các đỉnh cần xét. Khởi tạo: thêm đỉnh bắt đầu ${start} vào queue, đánh dấu đã thăm, thêm vào danh sách thứ tự duyệt.`,
      current: start,
      nodes: nodes.map(n => n.id)
    };
    steps.push(initStep);
    if (onStep) await onStep(initStep);

    visited.add(start);
    order.push(start);

    while (queue.length > 0) {
      const current = queue.shift()!;

      const visitStep: AlgorithmStep = {
        type: 'visit',
        message: `Bước ${steps.length + 1} - Xét đỉnh ${current}: Lấy đỉnh đầu tiên trong queue (${current}). Đây là đỉnh ở lớp gần nhất chưa được xét. Bây giờ ta sẽ xét tất cả các đỉnh kề của ${current} chưa được thăm.`,
        current: current,
        visited: Array.from(visited),
        nodes: nodes.map(n => n.id)
      };
      steps.push(visitStep);
      if (onStep) await onStep(visitStep);

      // Find all neighbors
      for (const edge of edges) {
        let neighbor: string | null = null;
        if (edge.from === current && (edge.direction === 'forward' || edge.direction === 'bidirectional')) {
          neighbor = edge.to;
        } else if (edge.to === current && (edge.direction === 'backward' || edge.direction === 'bidirectional')) {
          neighbor = edge.from;
        }

        if (neighbor && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
          order.push(neighbor);
          parent[neighbor] = current;

          const discoverStep: AlgorithmStep = {
            type: 'update',
            message: `Phát hiện đỉnh mới ${neighbor}: Đỉnh ${neighbor} là đỉnh kề của ${current} và chưa được thăm. Thêm ${neighbor} vào cuối queue, đánh dấu đã thăm, lưu ${current} là đỉnh cha của ${neighbor}. Đỉnh ${neighbor} sẽ được xét sau khi xét hết các đỉnh ở lớp hiện tại.`,
            current: current,
            updated: neighbor,
            visited: Array.from(visited),
            nodes: nodes.map(n => n.id)
          };
          steps.push(discoverStep);
          if (onStep) await onStep(discoverStep);
        }
      }
    }

    const resultStep: AlgorithmStep = {
      type: 'result',
      message: `Kết quả cuối cùng: BFS đã duyệt hết tất cả các đỉnh có thể đến được từ ${start}. Thứ tự duyệt: ${order.join(' → ')}. Tổng số đỉnh đã thăm: ${visited.size}. BFS đảm bảo tìm được đường đi ngắn nhất (theo số cạnh) trong đồ thị không trọng số. Ứng dụng: Tìm đường đi ngắn nhất, kiểm tra tính liên thông, tìm cây khung.`,
      visited: Array.from(visited),
      nodes: nodes.map(n => n.id)
    };
    steps.push(resultStep);
    if (onStep) await onStep(resultStep);

    return {
      visited: Array.from(visited),
      order,
      steps
    };
  }

  /**
   * Depth-First Search (DFS)
   * Tìm kiếm theo chiều sâu: Duyệt sâu nhất có thể trước khi quay lại
   */
  static async dfs(
    nodes: GraphNode[],
    edges: GraphEdge[],
    start: string,
    onStep?: (step: AlgorithmStep) => Promise<void>
  ): Promise<{ visited: string[]; order: string[]; steps: AlgorithmStep[] }> {
    const steps: AlgorithmStep[] = [];
    const visited = new Set<string>();
    const order: string[] = [];
    const parent: Record<string, string | null> = { [start]: null };

    const initStep: AlgorithmStep = {
      type: 'init',
      message: `Bước 1 - Khởi tạo DFS (Depth-First Search - Tìm kiếm theo chiều sâu): DFS duyệt đồ thị bằng cách đi sâu nhất có thể trước khi quay lại. Sử dụng đệ quy hoặc stack. Khởi tạo: bắt đầu từ đỉnh ${start}, đánh dấu đã thăm, thêm vào danh sách thứ tự duyệt.`,
      current: start,
      nodes: nodes.map(n => n.id)
    };
    steps.push(initStep);
    if (onStep) await onStep(initStep);

    const dfsVisit = async (node: string) => {
      visited.add(node);
      order.push(node);

      const visitStep: AlgorithmStep = {
        type: 'visit',
        message: `Bước ${steps.length + 1} - Thăm đỉnh ${node}: Đánh dấu đỉnh ${node} đã được thăm. Bây giờ ta sẽ xét tất cả các đỉnh kề của ${node} chưa được thăm và gọi đệ quy để duyệt sâu vào từng nhánh.`,
        current: node,
        visited: Array.from(visited),
        nodes: nodes.map(n => n.id)
      };
      steps.push(visitStep);
      if (onStep) await onStep(visitStep);

      // Find all neighbors
      for (const edge of edges) {
        let neighbor: string | null = null;
        if (edge.from === node && (edge.direction === 'forward' || edge.direction === 'bidirectional')) {
          neighbor = edge.to;
        } else if (edge.to === node && (edge.direction === 'backward' || edge.direction === 'bidirectional')) {
          neighbor = edge.from;
        }

        if (neighbor && !visited.has(neighbor)) {
          parent[neighbor] = node;

          const discoverStep: AlgorithmStep = {
            type: 'update',
            message: `Phát hiện đỉnh mới ${neighbor}: Đỉnh ${neighbor} là đỉnh kề của ${node} và chưa được thăm. Gọi đệ quy để duyệt sâu vào ${neighbor} ngay lập tức (không chờ xét các đỉnh khác). Lưu ${node} là đỉnh cha của ${neighbor}.`,
            current: node,
            updated: neighbor,
            visited: Array.from(visited),
            nodes: nodes.map(n => n.id)
          };
          steps.push(discoverStep);
          if (onStep) await onStep(discoverStep);

          await dfsVisit(neighbor);
        }
      }
    };

    await dfsVisit(start);

    const resultStep: AlgorithmStep = {
      type: 'result',
      message: `Kết quả cuối cùng: DFS đã duyệt hết tất cả các đỉnh có thể đến được từ ${start}. Thứ tự duyệt: ${order.join(' → ')}. Tổng số đỉnh đã thăm: ${visited.size}. DFS tạo ra cây duyệt (DFS tree) với các cạnh nối từ đỉnh cha đến đỉnh con. Ứng dụng: Tìm chu trình, kiểm tra tính liên thông, topological sort, tìm thành phần liên thông.`,
      visited: Array.from(visited),
      nodes: nodes.map(n => n.id)
    };
    steps.push(resultStep);
    if (onStep) await onStep(resultStep);

    return {
      visited: Array.from(visited),
      order,
      steps
    };
  }

  /**
   * Cycle Detection
   * Tìm chu trình trong đồ thị
   */
  static async detectCycles(
    nodes: GraphNode[],
    edges: GraphEdge[],
    onStep?: (step: AlgorithmStep) => Promise<void>
  ): Promise<{ hasCycle: boolean; cycles: string[][]; steps: AlgorithmStep[] }> {
    const steps: AlgorithmStep[] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[][] = [];
    const parent: Record<string, string | null> = {};

    const initStep: AlgorithmStep = {
      type: 'init',
      message: `Bước 1 - Khởi tạo phát hiện chu trình: Sử dụng DFS với một stack đệ quy (recursion stack) để phát hiện back edge. Nếu trong quá trình DFS, ta gặp một đỉnh đã có trong stack đệ quy (đang được xét), nghĩa là có chu trình. Khởi tạo: tất cả đỉnh chưa được thăm.`,
      nodes: nodes.map(n => n.id)
    };
    steps.push(initStep);
    if (onStep) await onStep(initStep);

    const dfs = async (node: string, path: string[]): Promise<boolean> => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const visitStep: AlgorithmStep = {
        type: 'visit',
        message: `Bước ${steps.length + 1} - Thăm đỉnh ${node}: Đánh dấu đã thăm, thêm vào recursion stack (đang xét), thêm vào đường đi hiện tại. Đường đi hiện tại: ${path.join(' → ')}.`,
        current: node,
        visited: Array.from(visited),
        nodes: nodes.map(n => n.id)
      };
      steps.push(visitStep);
      if (onStep) await onStep(visitStep);

      for (const edge of edges) {
        let neighbor: string | null = null;
        if (edge.from === node && (edge.direction === 'forward' || edge.direction === 'bidirectional')) {
          neighbor = edge.to;
        } else if (edge.to === node && (edge.direction === 'backward' || edge.direction === 'bidirectional')) {
          neighbor = edge.from;
        }

        if (neighbor) {
          if (!visited.has(neighbor)) {
            parent[neighbor] = node;
            const hasCycle = await dfs(neighbor, [...path]);
            if (hasCycle) return true;
          } else if (recStack.has(neighbor)) {
            // Found back edge - cycle detected
            const cycleStart = path.indexOf(neighbor);
            const cycle = path.slice(cycleStart).concat([neighbor]);

            const cycleStep: AlgorithmStep = {
              type: 'update',
              message: `Phát hiện chu trình! Từ đỉnh ${node}, ta gặp lại đỉnh ${neighbor} đang có trong recursion stack. Điều này có nghĩa là có một đường đi từ ${neighbor} quay lại chính nó. Chu trình: ${cycle.join(' → ')}.`,
              current: node,
              updated: neighbor,
              nodes: nodes.map(n => n.id)
            };
            steps.push(cycleStep);
            if (onStep) await onStep(cycleStep);

            cycles.push(cycle);
          }
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        await dfs(node.id, []);
      }
    }

    const resultStep: AlgorithmStep = {
      type: 'result',
      message: `Kết quả cuối cùng: ${cycles.length > 0 ? `Phát hiện ${cycles.length} chu trình: ${cycles.map(c => c.join(' → ')).join('; ')}` : 'Không có chu trình trong đồ thị'}. Ứng dụng: Kiểm tra DAG (Directed Acyclic Graph), phát hiện deadlock, kiểm tra tính hợp lệ của dependency graph.`,
      nodes: nodes.map(n => n.id)
    };
    steps.push(resultStep);
    if (onStep) await onStep(resultStep);

    return {
      hasCycle: cycles.length > 0,
      cycles,
      steps
    };
  }

  /**
   * Connected Components
   * Tìm các thành phần liên thông trong đồ thị vô hướng
   */
  static async findConnectedComponents(
    nodes: GraphNode[],
    edges: GraphEdge[],
    onStep?: (step: AlgorithmStep) => Promise<void>
  ): Promise<{ components: string[][]; count: number; steps: AlgorithmStep[] }> {
    const steps: AlgorithmStep[] = [];
    const visited = new Set<string>();
    const components: string[][] = [];

    const initStep: AlgorithmStep = {
      type: 'init',
      message: `Bước 1 - Khởi tạo tìm thành phần liên thông: Một thành phần liên thông là một tập hợp các đỉnh mà từ bất kỳ đỉnh nào trong tập hợp, ta có thể đến được tất cả các đỉnh khác trong tập hợp. Sử dụng DFS hoặc BFS để tìm tất cả các thành phần. Khởi tạo: tất cả đỉnh chưa được thăm.`,
      nodes: nodes.map(n => n.id)
    };
    steps.push(initStep);
    if (onStep) await onStep(initStep);

    const dfs = async (node: string, component: string[]) => {
      visited.add(node);
      component.push(node);

      const visitStep: AlgorithmStep = {
        type: 'visit',
        message: `Thăm đỉnh ${node}: Thêm đỉnh ${node} vào thành phần liên thông hiện tại. Bây giờ ta sẽ tìm tất cả các đỉnh có thể đến được từ ${node} bằng DFS.`,
        current: node,
        visited: Array.from(visited),
        nodes: nodes.map(n => n.id)
      };
      steps.push(visitStep);
      if (onStep) await onStep(visitStep);

      for (const edge of edges) {
        let neighbor: string | null = null;
        // For connected components, we treat all edges as bidirectional
        if (edge.from === node) {
          neighbor = edge.to;
        } else if (edge.to === node) {
          neighbor = edge.from;
        }

        if (neighbor && !visited.has(neighbor)) {
          await dfs(neighbor, component);
        }
      }
    };

    let componentIndex = 0;
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const component: string[] = [];
        componentIndex++;

        const startComponentStep: AlgorithmStep = {
          type: 'init',
          message: `Bắt đầu thành phần liên thông ${componentIndex}: Phát hiện đỉnh ${node.id} chưa được thăm, đây là đỉnh đầu tiên của một thành phần liên thông mới. Sử dụng DFS để tìm tất cả các đỉnh trong thành phần này.`,
          current: node.id,
          visited: Array.from(visited),
          nodes: nodes.map(n => n.id)
        };
        steps.push(startComponentStep);
        if (onStep) await onStep(startComponentStep);

        await dfs(node.id, component);
        components.push(component);

        const endComponentStep: AlgorithmStep = {
          type: 'result',
          message: `Hoàn thành thành phần liên thông ${componentIndex}: Tìm được ${component.length} đỉnh: ${component.join(', ')}. Tất cả các đỉnh này có thể đến được lẫn nhau.`,
          visited: Array.from(visited),
          nodes: nodes.map(n => n.id)
        };
        steps.push(endComponentStep);
        if (onStep) await onStep(endComponentStep);
      }
    }

    const resultStep: AlgorithmStep = {
      type: 'result',
      message: `Kết quả cuối cùng: Tìm được ${components.length} thành phần liên thông. ${components.map((c, i) => `Thành phần ${i + 1}: ${c.join(', ')}`).join('; ')}. Ứng dụng: Phân tích mạng xã hội, phân cụm dữ liệu, kiểm tra tính liên thông của mạng.`,
      nodes: nodes.map(n => n.id)
    };
    steps.push(resultStep);
    if (onStep) await onStep(resultStep);

    return {
      components,
      count: components.length,
      steps
    };
  }

  /**
   * Strongly Connected Components (SCC) - Kosaraju's Algorithm
   * Tìm các thành phần liên thông mạnh trong đồ thị có hướng
   */
  static async findStronglyConnectedComponents(
    nodes: GraphNode[],
    edges: GraphEdge[],
    onStep?: (step: AlgorithmStep) => Promise<void>
  ): Promise<{ components: string[][]; count: number; steps: AlgorithmStep[] }> {
    const steps: AlgorithmStep[] = [];
    const visited = new Set<string>();
    const finishOrder: string[] = [];
    const components: string[][] = [];

    const initStep: AlgorithmStep = {
      type: 'init',
      message: `Bước 1 - Khởi tạo tìm thành phần liên thông mạnh (SCC - Strongly Connected Components): Một SCC là một tập hợp các đỉnh mà từ bất kỳ đỉnh nào, ta có thể đến được tất cả các đỉnh khác trong tập hợp (theo hướng của cạnh). Sử dụng thuật toán Kosaraju: 1) DFS để lấy thứ tự kết thúc, 2) Đảo ngược đồ thị, 3) DFS theo thứ tự ngược lại.`,
      nodes: nodes.map(n => n.id)
    };
    steps.push(initStep);
    if (onStep) await onStep(initStep);

    // Step 1: First DFS to get finish order
    const dfs1 = async (node: string) => {
      visited.add(node);

      const visitStep: AlgorithmStep = {
        type: 'visit',
        message: `DFS lần 1 - Thăm đỉnh ${node}: Đánh dấu đã thăm, tiếp tục DFS vào các đỉnh kề theo hướng của cạnh.`,
        current: node,
        visited: Array.from(visited),
        nodes: nodes.map(n => n.id)
      };
      steps.push(visitStep);
      if (onStep) await onStep(visitStep);

      for (const edge of edges) {
        if (edge.from === node && (edge.direction === 'forward' || edge.direction === 'bidirectional')) {
          const neighbor = edge.to;
          if (!visited.has(neighbor)) {
            await dfs1(neighbor);
          }
        }
      }

      finishOrder.unshift(node); // Add to front (finish order)
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        await dfs1(node.id);
      }
    }

    const finishOrderStep: AlgorithmStep = {
      type: 'result',
      message: `Hoàn thành DFS lần 1: Thứ tự kết thúc (finish order): ${finishOrder.join(' → ')}. Đỉnh kết thúc sau cùng sẽ được xét đầu tiên trong bước tiếp theo.`,
      nodes: nodes.map(n => n.id)
    };
    steps.push(finishOrderStep);
    if (onStep) await onStep(finishOrderStep);

    // Step 2: DFS on reversed graph
    visited.clear();
    let componentIndex = 0;

    const dfs2 = async (node: string, component: string[]) => {
      visited.add(node);
      component.push(node);

      const visitStep: AlgorithmStep = {
        type: 'visit',
        message: `DFS lần 2 (đồ thị đảo) - Thăm đỉnh ${node}: Thêm đỉnh ${node} vào SCC hiện tại. Xét các cạnh đảo ngược (từ đích về nguồn).`,
        current: node,
        visited: Array.from(visited),
        nodes: nodes.map(n => n.id)
      };
      steps.push(visitStep);
      if (onStep) await onStep(visitStep);

      for (const edge of edges) {
        // Reverse edge direction
        if (edge.to === node && (edge.direction === 'forward' || edge.direction === 'bidirectional')) {
          const neighbor = edge.from;
          if (!visited.has(neighbor)) {
            await dfs2(neighbor, component);
          }
        } else if (edge.from === node && edge.direction === 'backward') {
          const neighbor = edge.to;
          if (!visited.has(neighbor)) {
            await dfs2(neighbor, component);
          }
        }
      }
    };

    for (const nodeId of finishOrder) {
      if (!visited.has(nodeId)) {
        const component: string[] = [];
        componentIndex++;

        const startSCCStep: AlgorithmStep = {
          type: 'init',
          message: `Bắt đầu SCC ${componentIndex}: Bắt đầu từ đỉnh ${nodeId} (theo thứ tự finish order). Sử dụng DFS trên đồ thị đảo để tìm tất cả các đỉnh trong SCC này.`,
          current: nodeId,
          visited: Array.from(visited),
          nodes: nodes.map(n => n.id)
        };
        steps.push(startSCCStep);
        if (onStep) await onStep(startSCCStep);

        await dfs2(nodeId, component);
        components.push(component);

        const endSCCStep: AlgorithmStep = {
          type: 'result',
          message: `Hoàn thành SCC ${componentIndex}: Tìm được ${component.length} đỉnh: ${component.join(', ')}. Tất cả các đỉnh này có thể đến được lẫn nhau theo cả hai hướng.`,
          visited: Array.from(visited),
          nodes: nodes.map(n => n.id)
        };
        steps.push(endSCCStep);
        if (onStep) await onStep(endSCCStep);
      }
    }

    const resultStep: AlgorithmStep = {
      type: 'result',
      message: `Kết quả cuối cùng: Tìm được ${components.length} thành phần liên thông mạnh (SCC). ${components.map((c, i) => `SCC ${i + 1}: ${c.join(', ')}`).join('; ')}. Ứng dụng: Phân tích dependency graph, tối ưu hóa compiler, phân tích mạng xã hội có hướng.`,
      nodes: nodes.map(n => n.id)
    };
    steps.push(resultStep);
    if (onStep) await onStep(resultStep);

    return {
      components,
      count: components.length,
      steps
    };
  }
}

