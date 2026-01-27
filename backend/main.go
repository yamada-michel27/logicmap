package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

type ParseRequest struct {
	Markdown string `json:"markdown"`
}

type Node struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	Data     map[string]interface{} `json:"data"`
	Position struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
	} `json:"position"`
}

type Edge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label,omitempty"`
}

type ParseResponse struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func parseHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ParseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Mock response with sample nodes and edges
	nodes := []Node{
		{
			ID:   "1",
			Type: "input",
			Data: map[string]interface{}{
				"label": "Start",
			},
			Position: struct {
				X float64 `json:"x"`
				Y float64 `json:"y"`
			}{X: 250, Y: 0},
		},
		{
			ID:   "2",
			Type: "default",
			Data: map[string]interface{}{
				"label": "Process: " + req.Markdown[:min(20, len(req.Markdown))] + "...",
			},
			Position: struct {
				X float64 `json:"x"`
				Y float64 `json:"y"`
			}{X: 250, Y: 100},
		},
		{
			ID:   "3",
			Type: "default",
			Data: map[string]interface{}{
				"label": "Decision",
			},
			Position: struct {
				X float64 `json:"x"`
				Y float64 `json:"y"`
			}{X: 250, Y: 200},
		},
		{
			ID:   "4",
			Type: "output",
			Data: map[string]interface{}{
				"label": "End",
			},
			Position: struct {
				X float64 `json:"x"`
				Y float64 `json:"y"`
			}{X: 250, Y: 300},
		},
	}

	edges := []Edge{
		{ID: "e1-2", Source: "1", Target: "2"},
		{ID: "e2-3", Source: "2", Target: "3"},
		{ID: "e3-4", Source: "3", Target: "4", Label: "true"},
	}

	response := ParseResponse{
		Nodes: nodes,
		Edges: edges,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

var numberedListPattern = regexp.MustCompile(`^\d+\.\s+`)

func buildFlowFromMarkdown(markdown string) ([]Node, []Edge) {
	const centerX = 250.0
	const branchSpread = 190.0
	const rowGap = 130.0

	type decisionState struct {
		id          string
		indent      int
		branchY     float64
		branchIDs   []string
		hasBranches bool
	}

	lines := strings.Split(markdown, "\n")
	nodes := make([]Node, 0)
	edges := make([]Edge, 0)
	nodeID := 1
	currentY := 0.0
	lastLinearID := ""
	pendingBranchIDs := make([]string, 0)
	var decision *decisionState
	suppressNextLinearConnect := false
	anchors := make(map[string]string)
	pendingLoopEdges := make([]pendingLoopEdge, 0)

	addNodeAt := func(nodeType, label string, x, y float64) string {
		cleanLabel := sanitizeLabel(label)
		id := fmt.Sprintf("%d", nodeID)
		nodes = append(nodes, buildNode(nodeID, nodeType, truncateRunes(cleanLabel, 40), x, y))
		nodeID++
		return id
	}

	registerAnchor := func(anchor, id string) {
		if anchor == "" {
			return
		}
		if _, exists := anchors[anchor]; exists {
			return
		}
		anchors[anchor] = id
	}

	addMainNode := func(nodeType, label string) string {
		id := addNodeAt(nodeType, label, centerX, currentY)
		currentY += rowGap
		return id
	}

	connect := func(source, target, label string, options *edgeOptions) {
		if source == "" || target == "" {
			return
		}
		edge := Edge{
			ID:     fmt.Sprintf("e%s-%s", source, target),
			Source: source,
			Target: target,
		}
		if label != "" {
			edge.Label = label
		}
		if options != nil {
			if options.edgeType != "" {
				edge.Type = options.edgeType
			}
			if options.animated {
				edge.Animated = true
			}
			if len(options.style) > 0 {
				edge.Style = options.style
			}
		}
		edges = append(edges, edge)
	}

	finalizeDecision := func() {
		if decision == nil {
			return
		}
		if len(decision.branchIDs) > 0 {
			applyBranchLayout(nodes, decision.branchIDs, decision.branchY, centerX, branchSpread)
			afterBranchY := decision.branchY + rowGap
			if currentY < afterBranchY {
				currentY = afterBranchY
			}
		}
		if decision.hasBranches && len(pendingBranchIDs) == 0 {
			suppressNextLinearConnect = true
		}
		decision = nil
	}

	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}

		trimmed := strings.TrimSpace(line)
		isBullet := isBulletLine(line)
		isNumbered := isNumberedLine(line)
		if strings.HasPrefix(trimmed, "#") && lastLinearID == "" && decision == nil {
			title := strings.TrimSpace(strings.TrimLeft(trimmed, "#"))
			if title != "" {
				lastLinearID = addMainNode("input", title)
			}
			continue
		}

		indent := leadingIndent(line)
		content, _ := stripListPrefix(trimmed)
		if content == "" {
			continue
		}

		if decision != nil && isNumbered {
			finalizeDecision()
		}

		if decision != nil && !isNumbered && (indent > decision.indent || isBullet || isBranchLabelLine(content)) {
			branchLabel, branchText := splitBranchLabel(content)
			if branchLabel == "" {
				branchLabel, branchText = extractBranchPrefix(content)
			}
			if branchLabel == "" || containsReplacement(branchLabel) {
				branchLabel = fallbackBranchLabel(len(decision.branchIDs))
			}
			branchText, loopTarget := extractGotoTarget(branchText)
			decision.hasBranches = true
			branchText = strings.TrimSpace(branchText)
			isDirectJump := loopTarget != "" && branchText == ""
			if isDirectJump {
				pendingLoopEdges = append(pendingLoopEdges, pendingLoopEdge{
					sourceID:  decision.id,
					targetKey: loopTarget,
					label:     branchLabel,
				})
				continue
			}
			if branchText == "" {
				if branchLabel != "" {
					branchText = branchLabel
				} else {
					branchText = "戻る"
				}
			}
			branchAnchor, cleanedBranchText := extractAnchor(branchText)
			if cleanedBranchText != "" {
				branchText = cleanedBranchText
			}
			branchText = stripBranchLabelPrefix(branchText)
			displayText := sanitizeLabel(branchText)
			if displayText == "" && loopTarget != "" {
				pendingLoopEdges = append(pendingLoopEdges, pendingLoopEdge{
					sourceID:  decision.id,
					targetKey: loopTarget,
					label:     branchLabel,
				})
				continue
			}
			branchNodeLabel := displayText
			if branchNodeLabel == "" {
				branchNodeLabel = branchLabel
			}
			branchID := addNodeAt("default", branchNodeLabel, centerX, decision.branchY)
			registerAnchor(branchAnchor, branchID)
			connect(decision.id, branchID, branchLabel, nil)
			if loopTarget != "" {
				pendingLoopEdges = append(pendingLoopEdges, pendingLoopEdge{
					sourceID:  branchID,
					targetKey: loopTarget,
					label:     "",
				})
			} else {
				pendingBranchIDs = append(pendingBranchIDs, branchID)
			}
			decision.branchIDs = append(decision.branchIDs, branchID)
			continue
		}

		if decision != nil && indent <= decision.indent && !isBullet && !isNumbered {
			finalizeDecision()
		}

		anchor, cleanedContent := extractAnchor(content)
		if cleanedContent != "" {
			content = cleanedContent
		}

		isDecision := isDecisionText(content)
		label := content
		if isDecision {
			label = normalizeDecisionLabel(content)
		}

		currentID := addMainNode("default", label)
		registerAnchor(anchor, currentID)
		if len(pendingBranchIDs) > 0 {
			for _, branchID := range pendingBranchIDs {
				connect(branchID, currentID, "", nil)
			}
			pendingBranchIDs = pendingBranchIDs[:0]
		} else if !suppressNextLinearConnect {
			connect(lastLinearID, currentID, "", nil)
		}
		suppressNextLinearConnect = false
		lastLinearID = currentID
		if isDecision {
			decision = &decisionState{
				id:        currentID,
				indent:    indent,
				branchY:   currentY,
				branchIDs: make([]string, 0),
			}
		}
	}

	finalizeDecision()

	if len(nodes) == 0 {
		nodes = append(nodes, buildNode(1, "default", "ステップが見つかりませんでした", 250, 0))
	}

	resolveLoopEdges(anchors, pendingLoopEdges, nodes, func(edge Edge) {
		edges = append(edges, edge)
	})

	return nodes, edges
}

func stripListPrefix(line string) (string, bool) {
	trimmed := strings.TrimLeft(line, " \t")
	if strings.HasPrefix(trimmed, "-") || strings.HasPrefix(trimmed, "*") {
		rest := strings.TrimSpace(trimmed[1:])
		return rest, true
	}
	if loc := numberedListPattern.FindStringIndex(trimmed); loc != nil {
		return strings.TrimSpace(trimmed[loc[1]:]), true
	}
	return strings.TrimSpace(line), false
}

func truncateRunes(text string, max int) string {
	trimmed := strings.TrimSpace(text)
	runes := []rune(trimmed)
	if len(runes) <= max {
		return trimmed
	}
	return string(runes[:max]) + "..."
}

func buildNode(id int, nodeType, label string, x, y float64) Node {
	return Node{
		ID:   fmt.Sprintf("%d", id),
		Type: nodeType,
		Data: map[string]interface{}{
			"label": label,
		},
		Position: struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
		}{X: x, Y: y},
	}
}

func sanitizeLabel(label string) string {
	trimmed := strings.TrimSpace(label)
	trimmed = strings.ReplaceAll(trimmed, "\uFFFD", "")
	if cleaned, target := extractGotoTarget(trimmed); target != "" {
		trimmed = cleaned
	}
	trimmed = strings.TrimLeft(trimmed, "-*・")
	trimmed = strings.TrimSpace(trimmed)
	if _, rest := extractAnchor(trimmed); rest != "" {
		trimmed = rest
	}
	if cleaned, target := extractGotoTarget(trimmed); target != "" {
		trimmed = cleaned
	}
	return strings.TrimSpace(trimmed)
}

func applyBranchLayout(nodes []Node, branchIDs []string, branchY, centerX, spread float64) {
	if len(branchIDs) == 0 {
		return
	}
	for i, id := range branchIDs {
		offset := branchOffset(i, len(branchIDs), spread)
		updateNodePosition(nodes, id, centerX+offset, branchY)
	}
}

func branchOffset(index, total int, spread float64) float64 {
	if total <= 1 {
		return 0
	}
	return (float64(index) - float64(total-1)/2) * spread
}

func updateNodePosition(nodes []Node, id string, x, y float64) {
	for i := range nodes {
		if nodes[i].ID == id {
			nodes[i].Position.X = x
			nodes[i].Position.Y = y
			return
		}
	}
}

func buildNodePositionMap(nodes []Node) map[string]float64 {
	positions := make(map[string]float64, len(nodes))
	for _, node := range nodes {
		positions[node.ID] = node.Position.Y
	}
	return positions
}

func isBulletLine(line string) bool {
	trimmed := strings.TrimLeft(line, " \t")
	return strings.HasPrefix(trimmed, "- ") || strings.HasPrefix(trimmed, "* ")
}

func isNumberedLine(line string) bool {
	trimmed := strings.TrimLeft(line, " \t")
	return numberedListPattern.MatchString(trimmed)
}

func isBranchLabelLine(content string) bool {
	_, rest := extractBranchPrefix(content)
	return rest != ""
}

var branchPrefixPattern = regexp.MustCompile(`^(はい|いいえ|Yes|No)\s*[:：]\s*(.*)$`)

func extractBranchPrefix(text string) (string, string) {
	trimmed := strings.TrimSpace(text)
	match := branchPrefixPattern.FindStringSubmatch(trimmed)
	if len(match) != 3 {
		return "", trimmed
	}
	label := match[1]
	body := strings.TrimSpace(match[2])
	return label, body
}

func stripBranchLabelPrefix(text string) string {
	_, body := extractBranchPrefix(text)
	return body
}

func containsReplacement(text string) bool {
	return strings.Contains(text, "\uFFFD")
}

func fallbackBranchLabel(index int) string {
	switch index {
	case 0:
		return "はい"
	case 1:
		return "いいえ"
	default:
		return "分岐"
	}
}

type pendingLoopEdge struct {
	sourceID  string
	targetKey string
	label     string
}

type edgeOptions struct {
	edgeType string
	animated bool
	style    map[string]string
}

func resolveLoopEdges(anchors map[string]string, edges []pendingLoopEdge, nodes []Node, appendEdge func(Edge)) {
	positions := buildNodePositionMap(nodes)
	for _, edge := range edges {
		targetID, ok := anchors[edge.targetKey]
		if !ok {
			continue
		}
		sourceY := positions[edge.sourceID]
		targetY := positions[targetID]
		isBackward := targetY < sourceY
		style := map[string]string{}
		animated := false
		if isBackward {
			animated = true
			style = map[string]string{
				"stroke":          "#0f4c5c",
				"strokeDasharray": "6 4",
			}
		}
		appendEdge(Edge{
			ID:       fmt.Sprintf("e%s-%s-loop", edge.sourceID, targetID),
			Source:   edge.sourceID,
			Target:   targetID,
			Label:    edge.label,
			Type:     "smoothstep",
			Animated: animated,
			Style:    style,
		})
	}
}

var anchorPattern = regexp.MustCompile(`^\[[\p{L}\p{N}_-]+\]`)
var gotoPattern = regexp.MustCompile(`\s*->\s*\[?([\p{L}\p{N}_-]+)\]?\s*$`)

func extractAnchor(text string) (string, string) {
	trimmed := strings.TrimSpace(text)
	if !strings.HasPrefix(trimmed, "[") {
		return "", trimmed
	}
	loc := anchorPattern.FindStringIndex(trimmed)
	if loc == nil {
		return "", trimmed
	}
	anchor := strings.TrimSuffix(strings.TrimPrefix(trimmed[:loc[1]], "["), "]")
	rest := strings.TrimSpace(trimmed[loc[1]:])
	return anchor, rest
}

func extractGotoTarget(text string) (string, string) {
	trimmed := strings.TrimSpace(text)
	matches := gotoPattern.FindStringSubmatch(trimmed)
	if len(matches) != 2 {
		return trimmed, ""
	}
	target := matches[1]
	cleaned := strings.TrimSpace(trimmed[:len(trimmed)-len(matches[0])])
	return cleaned, target
}

func leadingIndent(line string) int {
	count := 0
	for _, r := range line {
		if r == ' ' {
			count++
			continue
		}
		if r == '\t' {
			count += 2
			continue
		}
		break
	}
	return count
}

func isDecisionText(text string) bool {
	trimmed := strings.TrimSpace(text)
	lower := strings.ToLower(trimmed)
	return strings.HasPrefix(trimmed, "?") ||
		strings.HasPrefix(lower, "if ") ||
		strings.HasPrefix(lower, "if:") ||
		strings.HasPrefix(trimmed, "条件:")
}

func normalizeDecisionLabel(text string) string {
	trimmed := strings.TrimSpace(text)
	if strings.HasPrefix(trimmed, "?") {
		trimmed = strings.TrimSpace(strings.TrimPrefix(trimmed, "?"))
	}
	lower := strings.ToLower(trimmed)
	if strings.HasPrefix(lower, "if ") {
		trimmed = strings.TrimSpace(trimmed[3:])
	} else if strings.HasPrefix(lower, "if:") {
		trimmed = strings.TrimSpace(trimmed[3:])
	} else if strings.HasPrefix(trimmed, "条件:") {
		trimmed = strings.TrimSpace(strings.TrimPrefix(trimmed, "条件:"))
	}
	if trimmed == "" {
		return "判定？"
	}
	if strings.HasSuffix(trimmed, "?") || strings.HasSuffix(trimmed, "？") {
		return trimmed
	}
	return trimmed + "？"
}

func splitBranchLabel(text string) (string, string) {
	trimmed := strings.TrimSpace(text)
	if idx := strings.IndexRune(trimmed, ':'); idx != -1 {
		label := strings.TrimSpace(trimmed[:idx])
		body := strings.TrimSpace(trimmed[idx+1:])
		if body == "" {
			body = trimmed
			label = ""
		}
		return label, body
	}
	if idx := strings.IndexRune(trimmed, '：'); idx != -1 {
		label := strings.TrimSpace(trimmed[:idx])
		body := strings.TrimSpace(trimmed[idx+1:])
		if body == "" {
			body = trimmed
			label = ""
		}
		return label, body
	}
	return "", trimmed
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Healthcheck mode: allows container healthcheck without extra tools
	if len(os.Args) > 1 && os.Args[1] == "-healthcheck" {
		if err := runHealthCheck(port); err != nil {
			log.Printf("healthcheck failed: %v", err)
			os.Exit(1)
		}
		return
	}

	http.HandleFunc("/parse", parseHandler)
	http.HandleFunc("/health", healthHandler)

	log.Printf("Server starting on port %s...", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func runHealthCheck(port string) error {
	target := "http://localhost:" + port + "/health"
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get(target)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status: %s", resp.Status)
	}

	return nil
}
