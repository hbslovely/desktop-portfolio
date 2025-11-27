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
}

