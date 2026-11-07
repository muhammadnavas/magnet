import React from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const PALETTE = ["#398BFF", "#20B8E8", "#35C99A", "#E6A64B", "#A78BFA"];
const EVENT_META = {
  milestone: { label: "Milestone", color: "#398BFF" },
  opportunity: { label: "Opportunity", color: "#20B8E8" },
  risk: { label: "Risk", color: "#E6A64B" },
  checkpoint: { label: "Checkpoint", color: "#35A9D6" },
  decision: { label: "Decision", color: "#A78BFA" },
};

function formatDate(event) {
  if (event.expected_date) {
    return new Date(event.expected_date + "T00:00:00").toLocaleDateString(undefined, {
      day: "numeric", month: "short", year: "numeric",
    });
  }
  return `Week ${Math.max(1, Math.ceil((event.offset_days || 0) / 7))}`;
}

export default function MultiverseTree({
  title, branches = [], selectedAlternative, onSelectFollowUp, followUpPending,
}) {
  const names = new Set(branches.map((item) => item.name));
  const roots = branches.filter((item) => !item.parent_alternative || !names.has(item.parent_alternative));
  const childrenByParent = branches.reduce((map, item) => {
    if (item.parent_alternative && names.has(item.parent_alternative)) {
      (map[item.parent_alternative] ||= []).push(item);
    }
    return map;
  }, {});
  const ordered = [];
  const visit = (branch, depth = 0) => {
    ordered.push({ branch, depth });
    (childrenByParent[branch.name] || []).forEach((child) => visit(child, depth + 1));
  };
  roots.forEach((branch) => visit(branch));
  const canvasWidth = Math.max(660, 180 + Math.max(1, ...ordered.map(({ branch }) => branch.timeline?.length || 0)) * 185);
  const laneHeight = 174;
  const originY = 94;
  const firstLaneY = 190;
  const canvasHeight = firstLaneY + Math.max(1, ordered.length) * laneHeight + 24;
  const line = (left, top, width, height = 2, color = "#2868B8") => ({
    position: "absolute", left, top, width, height, backgroundColor: color,
  });

  return (
    <View style={{ borderRadius: 22, paddingVertical: 17, backgroundColor: "#090D16", borderWidth: 1, borderColor: "#243A59", overflow: "hidden" }}>
      <View style={{ paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: "#F4F7FF", fontSize: 15, fontWeight: "900", letterSpacing: 1.1 }}>POSSIBLE FUTURE PATHS</Text>
          <Text style={{ color: "#91A6C4", fontSize: 10, marginTop: 4 }}>One starting point. Different possible outcomes.</Text>
        </View>
        <View style={{ borderWidth: 1, borderColor: "#285E9A", backgroundColor: "#10243D", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }}>
          <Text style={{ color: "#80B9FF", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 }}>SCENARIOS</Text>
        </View>
      </View>

      {ordered.length === 0 ? (
        <View style={{ padding: 22, alignItems: "center" }}>
          <Text style={{ color: "#A7B8CF", fontSize: 12, textAlign: "center" }}>Generate possible futures to open the first branches of your timeline.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ width: canvasWidth, height: canvasHeight }}>
            <View style={{ position: "absolute", left: 18, top: 14, width: 132, minHeight: 58, borderRadius: 12, borderWidth: 1.5, borderColor: "#438BEA", backgroundColor: "#101D31", alignItems: "center", justifyContent: "center", padding: 9 }}>
              <Text style={{ color: "#7EB6FF", fontSize: 8, fontWeight: "900", letterSpacing: 1 }}>STARTING POINT</Text>
              <Text numberOfLines={2} style={{ color: "#F4F7FF", fontSize: 12, fontWeight: "800", textAlign: "center", marginTop: 4 }}>{title}</Text>
            </View>
            <View style={{ position: "absolute", left: 83, top: 72, width: 2, height: 22 + ordered.length * laneHeight, backgroundColor: "#285E9A" }} />
            {ordered.map(({ branch, depth }, index) => {
              const y = firstLaneY + index * laneHeight;
              const tint = PALETTE[index % PALETTE.length];
              const active = selectedAlternative === branch.name;
              const events = branch.timeline || [];
              const xStart = 184 + depth * 18;
              const eventGap = 178;
              const endX = xStart + Math.max(1, events.length) * eventGap - 12;
              return (
                <View key={branch.name} style={{ position: "absolute", left: 0, top: y - 22, width: canvasWidth, height: laneHeight }}>
                  <View style={line(82, 21, Math.max(35, xStart - 82), 2, tint + "AA")} />
                  <View style={{ position: "absolute", left: 76, top: 15, width: 13, height: 13, borderRadius: 7, backgroundColor: tint, borderWidth: 2, borderColor: "#090D16" }} />
                  <Text numberOfLines={2} style={{ position: "absolute", left: xStart, top: 0, width: 230, color: active ? "#FFFFFF" : "#DCE8F8", fontSize: 12, fontWeight: "900" }}>{branch.name}{active ? "  • CURRENT" : ""}</Text>
                  <View style={line(xStart, 28, Math.max(70, endX - xStart), 2, tint + "99")} />
                  {events.length ? events.map((event, eventIndex) => {
                    const meta = EVENT_META[event.event_type] || EVENT_META.milestone;
                    const x = xStart + eventIndex * eventGap;
                    return (
                      <View key={String(event.id || event.title) + eventIndex} style={{ position: "absolute", left: x - 2, top: 19, width: 154 }}>
                        <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: meta.color, backgroundColor: "#090D16", alignItems: "center", justifyContent: "center" }}>
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: meta.color }} />
                        </View>
                        <View style={{ paddingTop: 7, paddingLeft: 1 }}>
                          <Text style={{ color: meta.color, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 }}>{meta.label.toUpperCase()}</Text>
                          <Text style={{ color: "#8195B2", fontSize: 8, marginTop: 3 }}>{formatDate(event)}</Text>
                          <Text style={{ color: "#F0F5FF", fontSize: 10, fontWeight: "800", marginTop: 4 }} numberOfLines={3}>{event.title}</Text>
                          {event.description ? <Text style={{ color: "#A6B4C9", fontSize: 9, lineHeight: 13, marginTop: 3 }} numberOfLines={3}>{event.description}</Text> : null}
                          {event.source ? <Text style={{ color: "#71839D", fontSize: 8, marginTop: 4 }}>{event.source === "ai_generated" ? "Hypothetical scenario" : event.source === "user_input" ? "Added by you" : "Planning checkpoint"}</Text> : null}
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
                      </View>
                    );
                  }) : (
                    <Text style={{ position: "absolute", left: xStart, top: 43, color: "#91A6C4", fontSize: 10 }}>No events mapped yet.</Text>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
      <View style={{ marginHorizontal: 15, marginTop: 9, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#243A59", flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Ionicons name="information-circle-outline" size={13} color="#7195C0" />
        <Text style={{ color: "#8FA3BE", fontSize: 9, flex: 1, lineHeight: 13 }}>Lines show possible paths and nodes mark events. Scenarios are possibilities, not predictions. Swipe sideways to follow the timeline.</Text>
      </View>
    </View>
  );
}
