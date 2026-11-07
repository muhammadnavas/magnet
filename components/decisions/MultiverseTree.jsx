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
  title,
  branches = [],
  selectedAlternative,
  onSelectFollowUp,
  followUpPending,
  colors,
}) {
  const c = colors;
  const card = {
    backgroundColor: "#11111B",
    borderColor: "#29283D",
    borderWidth: 1,
    borderRadius: 16,
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
        <View style={{ width: 2, height: 17, backgroundColor: "#7664D8" }} />
        <View style={{ ...card, width: "100%", padding: 13, borderColor: "#7866E8", backgroundColor: "#171429", alignItems: "center" }}>
          <Text style={{ color: "#A99AFF", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }}>ORIGIN REALITY</Text>
          <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800", textAlign: "center", marginTop: 5 }}>{title}</Text>
          <Text style={{ color: "#9994B8", fontSize: 10, marginTop: 4 }}>Your starting point</Text>
        </View>
        <View style={{ height: 22, width: 2, backgroundColor: "#6554C8" }} />
        <View style={{ height: 1, alignSelf: "stretch", backgroundColor: "#51448F" }} />
      </View>

      {branches.length === 0 ? (
        <View style={{ padding: 22, alignItems: "center" }}>
          <Text style={{ color: "#A7A3BC", fontSize: 12, textAlign: "center" }}>Generate possible futures to open the first branches of your multiverse.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 0, paddingBottom: 8 }}><View pointerEvents="none" style={{ position: "absolute", top: 0, left: 12, right: 12, height: 1, backgroundColor: "#514A70" }} />
          {branches.map((branch, branchIndex) => {
            const tint = PALETTE[branchIndex % PALETTE.length];
            const active = selectedAlternative === branch.name;
            return (
              <View key={branch.name} style={{ width: 270, marginHorizontal: 5 }}>
                <View style={{ alignItems: "center", height: 25 }}>
                  <View style={{ width: 2, height: 13, backgroundColor: tint, opacity: 0.9 }} />
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tint, borderWidth: 2, borderColor: "#090912" }} />
                </View>
                <View style={{ ...card, borderColor: active ? tint : "#29283D", padding: 12, backgroundColor: active ? tint + "12" : "#11111B" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tint }} />
                    <Text numberOfLines={2} style={{ flex: 1, color: "#F4F0FF", fontSize: 13, fontWeight: "900" }}>{branch.name}</Text>
                    {active ? <Text style={{ color: tint, fontSize: 8, fontWeight: "900" }}>CURRENT</Text> : null}
                  </View>
                  {branch.timeline?.length ? branch.timeline.map((event, eventIndex) => {
                    const meta = EVENT_META[event.event_type] || EVENT_META.milestone;
                    const isLast = eventIndex === branch.timeline.length - 1;
                    return (
                      <View key={String(event.id || event.title) + eventIndex} style={{ flexDirection: "row", gap: 9, marginTop: 12 }}>
                        <View style={{ width: 18, alignItems: "center" }}>
                          <View style={{ width: 17, height: 17, borderRadius: 9, backgroundColor: meta.color + "22", borderWidth: 1, borderColor: meta.color + "99", alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name={meta.icon} size={9} color={meta.color} />
                          </View>
                          {!isLast ? <View style={{ width: 1, flex: 1, minHeight: 34, backgroundColor: "#3C3855", marginTop: 3 }} /> : null}
                        </View>
                        <View style={{ flex: 1, paddingBottom: 7 }}>
                          <View style={{ ...card, padding: 10, borderRadius: 12, borderColor: event.event_type === "decision" ? "#7656B8" : "#302D43" }}>
                            <Text style={{ color: meta.color, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 }}>{meta.label.toUpperCase()}</Text>
                            <Text style={{ color: "#F4F0FF", fontSize: 11, fontWeight: "800", marginTop: 4 }}>{event.title}</Text>
                            {event.description ? <Text style={{ color: "#AAA6BD", fontSize: 10, lineHeight: 15, marginTop: 4 }}>{event.description}</Text> : null}
                            {event.source ? <Text style={{ color: "#77738F", fontSize: 8, marginTop: 6 }}>{event.source === "ai_generated" ? "AI scenario · hypothetical" : event.source === "user_input" ? "Added by you" : "Planning checkpoint"}</Text> : null}
                            {event.follow_up_options?.length ? (
                              <View style={{ marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#302D43" }}>
                                <Text style={{ color: "#A69BCB", fontSize: 8, fontWeight: "900", marginBottom: 6 }}>SPLIT THIS REALITY</Text>
                                {event.follow_up_options.map((option, optionIndex) => (
                                  <Pressable
                                    key={optionIndex}
                                    disabled={followUpPending}
                                    onPress={() => onSelectFollowUp?.({ eventId: event.id, option, parentAlternative: branch.name })}
                                    style={{ borderWidth: 1, borderColor: event.selected_follow_up_option === option ? tint : "#39344F", backgroundColor: event.selected_follow_up_option === option ? tint + "20" : "#191725", borderRadius: 9, paddingHorizontal: 8, paddingVertical: 8, marginTop: 5, opacity: followUpPending ? 0.55 : 1 }}
                                  >
                                    <Text style={{ color: event.selected_follow_up_option === option ? tint : "#D7D2E7", fontSize: 9, fontWeight: "700" }}>{option}  ›</Text>
                                  </Pressable>
                                ))}
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    );
                  }) : <Text style={{ color: "#89859E", fontSize: 10, marginTop: 12 }}>No events mapped on this path yet.</Text>}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={{ marginHorizontal: 15, marginTop: 9, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#29243F", flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Ionicons name="information-circle-outline" size={13} color="#8C83B2" />
        <Text style={{ color: "#8C86A5", fontSize: 9, flex: 1, lineHeight: 13 }}>Branches are possible scenarios, not predictions. Swipe sideways to explore other realities.</Text>
      </View>
    </View>
  );
}
