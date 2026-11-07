import React, { useMemo } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const COLORS = ["#398BFF", "#20B8E8", "#35C99A", "#E6A64B", "#A78BFA", "#F472B6"];
const META = {
  milestone: { label: "MILESTONE", color: "#398BFF" },
  opportunity: { label: "OPPORTUNITY", color: "#35C99A" },
  risk: { label: "RISK", color: "#E6A64B" },
  checkpoint: { label: "CHECKPOINT", color: "#20B8E8" },
  decision: { label: "DECISION", color: "#A78BFA" },
};
const line = (left, top, width, height, color) => ({
  position: "absolute", left, top, width, height, backgroundColor: color, borderRadius: 2,
});
const eventDate = (event) => event.expected_date
  ? new Date(event.expected_date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })
  : "Week " + Math.max(1, Math.ceil((event.offset_days || 0) / 7));

export default function MultiverseTree({ title, branches = [], selectedAlternative, onSelectFollowUp, followUpPending }) {
  const graph = useMemo(() => {
    const byName = new Map(branches.map((b) => [b.name, b]));
    const children = new Map();
    const roots = [];
    branches.forEach((b) => {
      if (b.parent_alternative && byName.has(b.parent_alternative)) {
        const list = children.get(b.parent_alternative) || [];
        list.push(b);
        children.set(b.parent_alternative, list);
      } else roots.push(b);
    });
    const rows = [];
    const visited = new Set();
    const walk = (b) => {
      if (visited.has(b.name)) return;
      visited.add(b.name);
      rows.push(b);
      (children.get(b.name) || []).forEach(walk);
    };
    roots.forEach(walk);
    branches.forEach(walk);

    const firstY = 190;
    const rowGap = 276;
    const yByName = new Map(rows.map((b, i) => [b.name, firstY + i * rowGap]));
    const xByName = new Map();
    const eventXs = new Map();
    const dayX = (day) => 220 + Math.max(0, day) * 1.15;
    rows.forEach((b) => {
      const start = b.parent_alternative && xByName.has(b.parent_alternative)
        ? xByName.get(b.parent_alternative) : 164;
      let previous = start + 26;
      const xs = (b.timeline || []).map((event) => {
        const x = Math.max(dayX(event.offset_days || 0), previous + 164);
        previous = x;
        return x;
      });
      eventXs.set(b.name, xs);
      const events = b.timeline || [];
      const selected = events.findIndex((e) => e.event_type === "decision" && e.selected_follow_up_option);
      const decision = events.findIndex((e) => e.event_type === "decision");
      const splitIndex = selected >= 0 ? selected : decision >= 0 ? decision : events.length - 1;
      xByName.set(b.name, splitIndex >= 0 ? xs[splitIndex] : start + 110);
    });
    const maxX = Math.max(0, ...Array.from(eventXs.values()).flat(), ...Array.from(xByName.values()));
    const originY = roots.length ? roots.reduce((sum, b) => sum + yByName.get(b.name), 0) / roots.length : firstY;
    return { roots, rows, children, yByName, xByName, eventXs, firstY, rowGap, originY, width: Math.max(760, maxX + 220), height: firstY + Math.max(1, rows.length) * rowGap + 20 };
  }, [branches]);

  const { roots, rows, children, yByName, xByName, eventXs, originY, width, height } = graph;

  return (
    <View style={{ borderRadius: 22, backgroundColor: "#080D16", borderWidth: 1, borderColor: "#243A59", overflow: "hidden", paddingTop: 17, paddingBottom: 12 }}>
      <View style={{ paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ color: "#F4F7FF", fontSize: 15, fontWeight: "900", letterSpacing: 1 }}>DECISION TIMELINE</Text>
          <Text style={{ color: "#91A6C4", fontSize: 10, marginTop: 4 }}>One starting point. Different possible paths.</Text>
        </View>
        <View style={{ borderWidth: 1, borderColor: "#285E9A", backgroundColor: "#10243D", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }}>
          <Text style={{ color: "#80B9FF", fontSize: 9, fontWeight: "800" }}>SCENARIOS</Text>
        </View>
      </View>
      {!rows.length ? (
        <View style={{ padding: 24, alignItems: "center" }}>
          <Text style={{ color: "#A7B8CF", fontSize: 12, textAlign: "center" }}>Generate possible futures to create your first branches.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ width, height }}>
            <View style={{ position: "absolute", left: 12, top: originY - 29, width: 118, minHeight: 58, borderRadius: 12, borderWidth: 1.5, borderColor: "#438BEA", backgroundColor: "#101D31", alignItems: "center", justifyContent: "center", padding: 8 }}>
              <Text style={{ color: "#7EB6FF", fontSize: 8, fontWeight: "900", letterSpacing: 0.8 }}>START</Text>
              <Text numberOfLines={2} style={{ color: "#F4F7FF", fontSize: 11, fontWeight: "800", textAlign: "center", marginTop: 3 }}>{title}</Text>
            </View>
            {roots.length > 1 ? (
              <>
                <View style={line(145, yByName.get(roots[0].name), 2, yByName.get(roots[roots.length - 1].name) - yByName.get(roots[0].name), "#3679C5")} />
                <View style={line(129, originY, 16, 2, "#3679C5")} />
              </>
            ) : null}
            {roots.map((b) => <View key={"origin-" + b.name} style={line(129, yByName.get(b.name), 30, 2, "#3679C5")} />)}

            {rows.map((branch, index) => {
              const y = yByName.get(branch.name);
              const parentName = branch.parent_alternative;
              const parentY = parentName ? yByName.get(parentName) : null;
              const splitX = parentName ? xByName.get(parentName) : null;
              const startX = parentName ? splitX : 159;
              const tint = COLORS[index % COLORS.length];
              const active = selectedAlternative === branch.name;
              const events = branch.timeline || [];
              const childBranches = children.get(branch.name) || [];
              const branchEndX = childBranches.length ? xByName.get(branch.name) : width - 25;

              return (
                <React.Fragment key={branch.name}>
                  {parentName && Number.isFinite(parentY) ? (
                    <>
                      <View style={line(splitX, Math.min(parentY, y), 2, Math.max(2, Math.abs(y - parentY)), tint + "CC")} />
                      <View style={line(splitX, y, 25, 2, tint + "CC")} />
                    </>
                  ) : null}
                  <View style={line(startX, y, Math.max(80, branchEndX - startX), 2, tint + "AA")} />
                  <View style={{ position: "absolute", left: startX - 5, top: y - 5, width: 12, height: 12, borderRadius: 6, backgroundColor: tint, borderWidth: 2, borderColor: "#080D16" }} />
                  <View style={{ position: "absolute", left: startX, top: y - 31, maxWidth: 280, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: "#111B2B", borderWidth: 1, borderColor: active ? tint : "#263B55" }}>
                    <Text numberOfLines={1} style={{ color: active ? "#FFFFFF" : "#DCE8F8", fontSize: 11, fontWeight: "900" }}>{branch.name}{active ? "  · CURRENT" : ""}</Text>
                  </View>

                  {events.map((event, eventIndex) => {
                    const x = eventXs.get(branch.name)?.[eventIndex] ?? (startX + 100);
                    const meta = META[event.event_type] || META.milestone;
                    return (
                      <React.Fragment key={String(event.id || event.title) + eventIndex}>
                        <View style={{ position: "absolute", left: x - 6, top: y - 6, width: 14, height: 14, borderRadius: 7, backgroundColor: meta.color, borderWidth: 2, borderColor: "#080D16" }} />
                        <View style={{ position: "absolute", left: x - 5, top: y + 13, width: 150, borderRadius: 10, padding: 9, backgroundColor: "#101827", borderWidth: 1, borderColor: event.event_type === "decision" ? meta.color : "#26364D" }}>
                          <Text style={{ color: meta.color, fontSize: 7, fontWeight: "900", letterSpacing: 0.5 }}>{meta.label}</Text>
                          <Text style={{ color: "#91A6C4", fontSize: 8, marginTop: 3 }}>{eventDate(event)}</Text>
                          <Text style={{ color: "#F0F5FF", fontSize: 9, fontWeight: "800", marginTop: 4 }} numberOfLines={3}>{event.title}</Text>
                          {event.description ? <Text style={{ color: "#A6B4C9", fontSize: 8, lineHeight: 12, marginTop: 3 }} numberOfLines={3}>{event.description}</Text> : null}
                          {event.source ? <Text style={{ color: "#71839D", fontSize: 7, marginTop: 4 }}>{event.source === "ai_generated" ? "Hypothetical" : event.source === "user_input" ? "Added by you" : "Checkpoint"}</Text> : null}
                          {event.follow_up_options?.length ? (
                            <View style={{ marginTop: 6 }}>
                              {event.follow_up_options.map((option, optionIndex) => (
                                <Pressable key={optionIndex} disabled={followUpPending || event.selected_follow_up_option === option}
                                  onPress={() => onSelectFollowUp?.({ eventId: event.id, option, parentAlternative: branch.name })}
                                  style={{ borderWidth: 1, borderColor: event.selected_follow_up_option === option ? tint : "#294362", backgroundColor: event.selected_follow_up_option === option ? tint + "22" : "#111C2C", borderRadius: 7, paddingHorizontal: 6, paddingVertical: 5, marginTop: 4, opacity: followUpPending || event.selected_follow_up_option === option ? 0.55 : 1 }}>
                                  <Text style={{ color: event.selected_follow_up_option === option ? tint : "#D8E6F8", fontSize: 8, fontWeight: "700" }}>{option}  ›</Text>
                                </Pressable>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      </React.Fragment>
                    );
                  })}
                  {childBranches.length && !events.length ? (
                    <View style={{ position: "absolute", left: xByName.get(branch.name) - 6, top: y - 6, width: 14, height: 14, borderRadius: 7, backgroundColor: tint, borderWidth: 2, borderColor: "#080D16" }} />
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>
        </ScrollView>
      )}
      <View style={{ marginHorizontal: 15, marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#243A59", flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Ionicons name="information-circle-outline" size={13} color="#7195C0" />
        <Text style={{ color: "#8FA3BE", fontSize: 9, flex: 1, lineHeight: 13 }}>Blue lines show the branches. Nodes mark events and decision points. Scenarios are possibilities, not predictions. Swipe sideways to explore.</Text>
      </View>
    </View>
  );
}
