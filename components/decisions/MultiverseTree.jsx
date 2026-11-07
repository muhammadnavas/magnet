import React from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const PALETTE = ["#9B8CFF", "#39BDF8", "#35D6A3", "#F2A65A", "#E879F9"];
const EVENT_META = {
  milestone: { label: "Milestone", icon: "flag-outline", color: "#9B8CFF" },
  opportunity: { label: "Opportunity", icon: "sparkles-outline", color: "#35D6A3" },
  risk: { label: "Risk", icon: "warning-outline", color: "#F2A65A" },
  checkpoint: { label: "Checkpoint", icon: "eye-outline", color: "#39BDF8" },
  decision: { label: "Decision point", icon: "git-branch-outline", color: "#E879F9" },
};

export default function MultiverseTree({
  title, branches = [], selectedAlternative, onSelectFollowUp, followUpPending,
}) {
  const card = { backgroundColor: "#11111B", borderColor: "#29283D", borderWidth: 1, borderRadius: 14 };
  const branchNames = new Set(branches.map((item) => item.name));
  const roots = branches.filter((item) => !item.parent_alternative || !branchNames.has(item.parent_alternative));
  const childrenByParent = branches.reduce((map, item) => {
    if (item.parent_alternative && branchNames.has(item.parent_alternative)) {
      (map[item.parent_alternative] ||= []).push(item);
    }
    return map;
  }, {});

  const renderBranch = (branch, depth = 0) => {
    const index = branches.findIndex((item) => item.name === branch.name);
    const tint = PALETTE[Math.max(0, index) % PALETTE.length];
    const active = selectedAlternative === branch.name;
    const children = childrenByParent[branch.name] || [];
    return (
      <View key={branch.name} style={{ width: Math.max(190, 264 - depth * 18), marginRight: 12, marginBottom: 12, marginLeft: depth ? 4 : 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }}>
          <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: tint, borderWidth: 2, borderColor: "#090912", marginRight: 8 }} />
          <Text numberOfLines={2} style={{ flex: 1, color: "#F4F0FF", fontSize: 13, fontWeight: "900" }}>{branch.name}</Text>
          {active ? <Text style={{ color: tint, fontSize: 8, fontWeight: "900" }}>CURRENT</Text> : null}
        </View>
        <View style={{ ...card, padding: 11, borderColor: active ? tint : "#29283D", backgroundColor: active ? tint + "12" : "#11111B" }}>
          {branch.timeline?.length ? branch.timeline.map((event, eventIndex) => {
            const meta = EVENT_META[event.event_type] || EVENT_META.milestone;
            const isLast = eventIndex === branch.timeline.length - 1;
            return (
              <View key={String(event.id || event.title) + eventIndex} style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <View style={{ width: 17, alignItems: "center" }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: meta.color + "22", borderWidth: 1, borderColor: meta.color + "99", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={meta.icon} size={9} color={meta.color} />
                  </View>
                  {!isLast ? <View style={{ width: 1, flex: 1, minHeight: 28, backgroundColor: "#514A70", marginTop: 3 }} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: 6 }}>
                  <View style={{ ...card, padding: 9, borderRadius: 11, borderColor: event.event_type === "decision" ? "#7656B8" : "#302D43" }}>
                    <Text style={{ color: meta.color, fontSize: 8, fontWeight: "900", letterSpacing: 0.6 }}>{meta.label.toUpperCase()}</Text>
                    <Text style={{ color: "#F4F0FF", fontSize: 11, fontWeight: "800", marginTop: 4 }}>{event.title}</Text>
                    {event.description ? <Text style={{ color: "#AAA6BD", fontSize: 10, lineHeight: 15, marginTop: 4 }}>{event.description}</Text> : null}
                    {event.source ? <Text style={{ color: "#77738F", fontSize: 8, marginTop: 6 }}>{event.source === "ai_generated" ? "AI scenario · hypothetical" : event.source === "user_input" ? "Added by you" : "Planning checkpoint"}</Text> : null}
                    {event.follow_up_options?.length ? (
                      <View style={{ marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#302D43" }}>
                        <Text style={{ color: "#A69BCB", fontSize: 8, fontWeight: "900", marginBottom: 5 }}>SPLIT THIS REALITY</Text>
                        {event.follow_up_options.map((option, optionIndex) => (
                          <Pressable key={optionIndex} disabled={followUpPending}
                            onPress={() => onSelectFollowUp?.({ eventId: event.id, option, parentAlternative: branch.name })}
                            style={{ borderWidth: 1, borderColor: event.selected_follow_up_option === option ? tint : "#39344F", backgroundColor: event.selected_follow_up_option === option ? tint + "20" : "#191725", borderRadius: 9, paddingHorizontal: 8, paddingVertical: 8, marginTop: 5, opacity: followUpPending ? 0.55 : 1 }}>
                            <Text style={{ color: event.selected_follow_up_option === option ? tint : "#D7D2E7", fontSize: 9, fontWeight: "700" }}>{option}  ›</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }) : <Text style={{ color: "#89859E", fontSize: 10, marginTop: 8 }}>No events mapped on this path yet.</Text>}
        </View>
        {children.length ? (
          <View style={{ marginLeft: 13, paddingLeft: 13, borderLeftWidth: 1.5, borderLeftColor: "#625B7D", marginTop: 2 }}>
            {children.map((child) => (
              <View key={child.name}>
                <View style={{ width: 13, height: 1.5, backgroundColor: "#625B7D", position: "absolute", left: -13, top: 15 }} />
                {renderBranch(child, depth + 1)}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ borderRadius: 22, paddingVertical: 17, backgroundColor: "#090912", borderWidth: 1, borderColor: "#29243F", overflow: "hidden" }}>
      <View style={{ paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: "#F4F0FF", fontSize: 15, fontWeight: "900", letterSpacing: 1.1 }}>MULTIVERSE MAP</Text>
          <Text style={{ color: "#8886A6", fontSize: 10, marginTop: 4 }}>One choice. Many possible realities.</Text>
        </View>
        <View style={{ borderWidth: 1, borderColor: "#6C63FF66", backgroundColor: "#6C63FF20", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }}>
          <Text style={{ color: "#B8AEFF", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 }}>HYPOTHETICAL</Text>
        </View>
      </View>
      <View style={{ alignItems: "center", paddingHorizontal: 18, marginTop: 19 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#C4B5FD" }} />
        <View style={{ width: 1.5, height: 17, backgroundColor: "#7664D8" }} />
        <View style={{ ...card, width: "100%", padding: 13, borderColor: "#7866E8", backgroundColor: "#171429", alignItems: "center" }}>
          <Text style={{ color: "#A99AFF", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }}>ORIGIN REALITY</Text>
          <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800", textAlign: "center", marginTop: 5 }}>{title}</Text>
          <Text style={{ color: "#9994B8", fontSize: 10, marginTop: 4 }}>Your starting point</Text>
        </View>
        <View style={{ height: 20, width: 1.5, backgroundColor: "#6554C8" }} />
        <View style={{ height: 1, alignSelf: "stretch", backgroundColor: "#51448F" }} />
      </View>
      {roots.length === 0 ? (
        <View style={{ padding: 22, alignItems: "center" }}>
          <Text style={{ color: "#A7A3BC", fontSize: 12, textAlign: "center" }}>Generate possible futures to open the first branches of your multiverse.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 }}>
          {roots.map((branch) => renderBranch(branch))}
        </ScrollView>
      )}
      <View style={{ marginHorizontal: 15, marginTop: 9, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#29243F", flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Ionicons name="information-circle-outline" size={13} color="#8C83B2" />
        <Text style={{ color: "#8C86A5", fontSize: 9, flex: 1, lineHeight: 13 }}>Branches are possible scenarios, not predictions. Swipe sideways to explore other realities.</Text>
      </View>
    </View>
  );
}
