import React from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const META = {
  milestone: { label: "MILESTONE", color: "#398BFF", icon: "flag-outline" },
  opportunity: { label: "OPPORTUNITY", color: "#35C99A", icon: "sparkles-outline" },
  risk: { label: "RISK", color: "#E6A64B", icon: "warning-outline" },
  checkpoint: { label: "CHECKPOINT", color: "#20B8E8", icon: "eye-outline" },
  decision: { label: "DECISION POINT", color: "#A78BFA", icon: "git-branch-outline" },
};

const eventDate = (event) => event.expected_date
  ? new Date(event.expected_date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  : "Week " + Math.max(1, Math.ceil((event.offset_days || 0) / 7));

export default function MultiverseTree({
  title, branches = [], selectedAlternative, onSelectFollowUp, followUpPending,
}) {
  const byName = new Map(branches.map((branch) => [branch.name, branch]));
  const roots = branches.filter((branch) => !branch.parent_alternative || !byName.has(branch.parent_alternative));
  const children = new Map();
  branches.forEach((branch) => {
    if (!branch.parent_alternative || !byName.has(branch.parent_alternative)) return;
    const list = children.get(branch.parent_alternative) || [];
    list.push(branch);
    children.set(branch.parent_alternative, list);
  });

  const renderBranch = (branch, depth = 0, ancestors = []) => {
    if (ancestors.includes(branch.name)) return null;
    const active = selectedAlternative === branch.name;
    const events = branch.timeline || [];
    const childBranches = children.get(branch.name) || [];
    const tint = depth === 0 ? "#438BEA" : "#8B7CF6";

    return (
      <View key={branch.name} style={{ width: depth === 0 ? 270 : 238, marginRight: depth === 0 ? 12 : 0, marginBottom: 12 }}>
        {depth === 0 ? <View style={{ height: 15, width: 1.5, backgroundColor: "#526C8C", marginLeft: 13 }} /> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: active ? tint : "#263B55", backgroundColor: active ? "#142943" : "#101B2B" }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: active ? "#80B9FF" : "#6F91B8" }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#F4F7FF", fontSize: 12, fontWeight: "900" }}>{branch.name}</Text>
            {branch.parent_alternative ? <Text style={{ color: "#91A6C4", fontSize: 9, marginTop: 3 }}>Branches from its parent reality</Text> : null}
          </View>
          {active ? <Text style={{ color: "#80B9FF", fontSize: 8, fontWeight: "900" }}>CURRENT</Text> : null}
        </View>

        <View style={{ marginLeft: 15, paddingLeft: 15, borderLeftWidth: 1.5, borderLeftColor: "#35516F", paddingTop: 10 }}>
          {events.map((event, eventIndex) => {
            const meta = META[event.event_type] || META.milestone;
            const chosen = Boolean(event.selected_follow_up_option);
            return (
              <View key={String(event.id || event.title) + eventIndex} style={{ marginBottom: eventIndex === events.length - 1 ? 5 : 10, position: "relative" }}>
                <View style={{ position: "absolute", left: -21, top: 13, width: 10, height: 10, borderRadius: 5, backgroundColor: meta.color, borderWidth: 2, borderColor: "#080D16" }} />
                <View style={{ borderWidth: 1, borderColor: event.event_type === "decision" ? meta.color + "99" : "#26364D", backgroundColor: "#111C2C", borderRadius: 12, padding: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1 }}>
                      <Ionicons name={meta.icon} size={12} color={meta.color} />
                      <Text style={{ color: meta.color, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 }}>{meta.label}</Text>
                    </View>
                    <Text style={{ color: "#91A6C4", fontSize: 9 }}>{eventDate(event)}</Text>
                  </View>
                  <Text style={{ color: "#F4F7FF", fontSize: 12, lineHeight: 17, fontWeight: "800", marginTop: 7 }}>{event.title}</Text>
                  {event.description ? <Text style={{ color: "#B4C1D3", fontSize: 10, lineHeight: 15, marginTop: 5 }}>{event.description}</Text> : null}
                  {event.source ? <Text style={{ color: "#71839D", fontSize: 8, marginTop: 6 }}>{event.source === "ai_generated" ? "Hypothetical scenario" : event.source === "user_input" ? "Added by you" : "Suggested checkpoint"}</Text> : null}
                  {event.follow_up_options?.length ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ color: "#A9B9CF", fontSize: 9, fontWeight: "800", marginBottom: 3 }}>CHOOSE A POSSIBLE NEXT PATH</Text>
                      {event.follow_up_options.map((option, optionIndex) => {
                        const selected = event.selected_follow_up_option === option;
                        return (
                          <Pressable key={optionIndex} disabled={followUpPending || chosen || !event.id}
                            onPress={() => onSelectFollowUp?.({ eventId: event.id, option, parentAlternative: branch.name })}
                            style={{ borderWidth: 1, borderColor: selected ? meta.color : "#294362", backgroundColor: selected ? meta.color + "18" : "#0D1725", borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, marginTop: 6, opacity: followUpPending && !selected ? 0.6 : 1 }}>
                            <Text style={{ color: selected ? meta.color : "#D8E6F8", fontSize: 10, lineHeight: 15, fontWeight: "700" }}>{option}{selected ? "  ✓" : "  ›"}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
          {!events.length ? <Text style={{ color: "#91A6C4", fontSize: 10, paddingVertical: 8 }}>No events yet. Add an event below.</Text> : null}
        </View>

        {childBranches.length ? (
          <View style={{ marginLeft: 17, paddingLeft: 12, borderLeftWidth: 1.5, borderLeftColor: "#766CC2", paddingTop: 5 }}>
            <Text style={{ color: "#9D91E8", fontSize: 8, fontWeight: "900", letterSpacing: 0.7, marginBottom: 7 }}>POSSIBLE CHILD REALITIES</Text>
            {childBranches.map((child) => (
              <View key={child.name}>
                <View style={{ position: "absolute", left: -12, top: 15, width: 12, height: 1.5, backgroundColor: "#766CC2" }} />
                {renderBranch(child, depth + 1, [...ancestors, branch.name])}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ borderRadius: 20, backgroundColor: "#080D16", borderWidth: 1, borderColor: "#243A59", padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ color: "#F4F7FF", fontSize: 15, fontWeight: "900", letterSpacing: 0.5 }}>MULTIVERSE DECISION MAP</Text>
          <Text style={{ color: "#91A6C4", fontSize: 11, marginTop: 4 }}>Each choice can open another possible reality.</Text>
        </View>
        <View style={{ borderWidth: 1, borderColor: "#285E9A", backgroundColor: "#10243D", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 }}>
          <Text style={{ color: "#80B9FF", fontSize: 9, fontWeight: "800" }}>SCENARIOS</Text>
        </View>
      </View>

      <View style={{ alignItems: "center", marginBottom: 2 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#80B9FF" }} />
        <View style={{ width: 1.5, height: 13, backgroundColor: "#526C8C" }} />
      </View>
      <View style={{ borderWidth: 1, borderColor: "#438BEA", backgroundColor: "#101D31", borderRadius: 13, padding: 12, marginBottom: 2 }}>
        <Text style={{ color: "#7EB6FF", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }}>STARTING POINT</Text>
        <Text style={{ color: "#F4F7FF", fontSize: 13, lineHeight: 18, fontWeight: "800", marginTop: 4 }}>{title}</Text>
      </View>
      <View style={{ alignItems: "center", marginBottom: 4 }}>
        <View style={{ width: 1.5, height: 14, backgroundColor: "#526C8C" }} />
        <View style={{ width: "78%", height: 1.5, backgroundColor: "#526C8C" }} />
      </View>

      {!branches.length ? (
        <View style={{ paddingVertical: 22, alignItems: "center" }}>
          <Ionicons name="git-branch-outline" size={26} color="#7195C0" />
          <Text style={{ color: "#A7B8CF", fontSize: 12, textAlign: "center", marginTop: 9 }}>Generate possible futures to create your first paths.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingTop: 0, paddingBottom: 4 }}>
          {roots.map((branch) => renderBranch(branch))}
        </ScrollView>
      )}

      <View style={{ marginTop: 8, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#243A59", flexDirection: "row", alignItems: "flex-start", gap: 7 }}>
        <Ionicons name="information-circle-outline" size={14} color="#7195C0" />
        <Text style={{ color: "#8FA3BE", fontSize: 9, flex: 1, lineHeight: 14 }}>Scenarios are possibilities, not predictions. Select a decision option to expand that reality into child branches.</Text>
      </View>
    </View>
  );
}
