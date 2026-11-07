import React, { useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput,
  View, RefreshControl, KeyboardAvoidingView, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../lib/api";
import MultiverseTree from "../components/decisions/MultiverseTree";
import { useAppTheme } from "../store/themeStore";

const TYPES = {
  milestone: { label: "Milestone", icon: "flag-outline", color: "#6C63FF" },
  opportunity: { label: "Opportunity", icon: "sparkles-outline", color: "#059669" },
  risk: { label: "Risk", icon: "warning-outline", color: "#DC6B45" },
  checkpoint: { label: "Checkpoint", icon: "eye-outline", color: "#0284C7" },
  decision: { label: "Decision point", icon: "git-branch-outline", color: "#A78BFA" },
};

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, colors }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.text.secondary, fontSize: 12, fontWeight: "700", marginBottom: 7 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        multiline={multiline}
        keyboardType={keyboardType || "default"}
        textAlignVertical={multiline ? "top" : "center"}
        style={{
          minHeight: multiline ? 100 : 48, borderWidth: 1, borderColor: colors.border,
          borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12,
          color: colors.text.primary, backgroundColor: colors.surface,
          fontSize: 14,
        }}
      />
    </View>
  );
}

function ActionButton({ label, onPress, colors, secondary, disabled, icon }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: 46, borderRadius: 13, paddingHorizontal: 16, paddingVertical: 12,
        alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
        backgroundColor: secondary ? colors.surface : colors.primary,
        borderWidth: secondary ? 1 : 0, borderColor: colors.border,
        opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={17} color={secondary ? colors.text.primary : "#FFFFFF"} /> : null}
      <Text style={{ color: secondary ? colors.text.primary : "#FFFFFF", fontWeight: "800", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export default function DecisionsScreen() {
  const { themeColors: c } = useAppTheme();
  const qc = useQueryClient();
  const [mode, setMode] = useState("list");
  const [selectedId, setSelectedId] = useState(null);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [alternativesText, setAlternativesText] = useState("Continue current path\nLeave and focus on other opportunities");
  const [horizon, setHorizon] = useState("3");
  const [uncertaintiesText, setUncertaintiesText] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDay, setEventDay] = useState("4");
  const [eventType, setEventType] = useState("opportunity");
  const [eventAlternative, setEventAlternative] = useState("*");
  const [followUpOptionsText, setFollowUpOptionsText] = useState("");

  const listQuery = useQuery({
    queryKey: ["decisions"],
    queryFn: async () => (await api.get("/decisions")).data,
  });
  const detailQuery = useQuery({
    queryKey: ["decision", selectedId],
    queryFn: async () => (await api.get("/decisions/" + selectedId)).data,
    enabled: Boolean(selectedId) && mode === "detail",
  });
  const timelineQuery = useQuery({
    queryKey: ["decision-timeline", selectedId],
    queryFn: async () => (await api.get("/decisions/" + selectedId + "/timeline")).data,
    enabled: Boolean(selectedId) && mode === "detail",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const alternatives = alternativesText.split("\n").map((name) => name.trim()).filter(Boolean);
      if (alternatives.length < 2) throw new Error("Add at least two alternatives, one per line.");
      return (await api.post("/decisions", {
        title: title.trim(),
        context: context.trim(),
        horizon_days: Math.max(30, Math.min(3650, (Number(horizon) || 3) * 30)),
        alternatives: alternatives.map((name) => ({ name })),
        uncertainties: uncertaintiesText.split("\n").map((item) => item.trim()).filter(Boolean),
        events: [],
      })).data;
    },
    onSuccess: async (decision) => {
      await qc.invalidateQueries({ queryKey: ["decisions"] });
      setSelectedId(decision.id);
      setMode("detail");
      setTitle(""); setContext(""); setUncertaintiesText("");
    },
    onError: (error) => Alert.alert("Could not create decision", error.response?.data?.detail || error.message),
  });

  const eventMutation = useMutation({
    mutationFn: async () => (await api.post("/decisions/" + selectedId + "/events", {
      alternative: eventAlternative,
      title: eventTitle.trim(),
      description: eventDescription.trim() || null,
      event_type: eventType,
      offset_days: Math.max(0, Math.min(3650, Math.round((Number(eventDay) || 0) * 7))),
      follow_up_options: followUpOptionsText.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 8),
    })).data,
    onSuccess: async () => {
      setEventTitle(""); setEventDescription(""); setFollowUpOptionsText("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["decision", selectedId] }),
        qc.invalidateQueries({ queryKey: ["decision-timeline", selectedId] }),
      ]);
    },
    onError: (error) => Alert.alert("Could not add event", error.response?.data?.detail || error.message),
  });

  const followUpMutation = useMutation({
    mutationFn: async ({ eventId, option, parentAlternative }) => (await api.patch("/decisions/" + selectedId + "/events/" + eventId, { selected_follow_up_option: option, parent_alternative: parentAlternative })).data,
    onSuccess: async (result) => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["decision", selectedId] }), qc.invalidateQueries({ queryKey: ["decision-timeline", selectedId] }), qc.invalidateQueries({ queryKey: ["decisions"] })]);
      Alert.alert("New future branch created", result.new_alternative + " is now available as a separate timeline.");
    },
    onError: (error) => Alert.alert("Could not create branch", error.response?.data?.detail || error.message),
  });

  const chooseMutation = useMutation({
    mutationFn: async (alternative) => (await api.patch("/decisions/" + selectedId, { selected_alternative: alternative })).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["decision", selectedId] });
      await qc.invalidateQueries({ queryKey: ["decisions"] });
    },
    onError: (error) => Alert.alert("Could not save choice", error.response?.data?.detail || error.message),
  });

  const simulateMutation = useMutation({
    mutationFn: async () => (await api.post("/decisions/" + selectedId + "/simulate")).data,
    onSuccess: async (result) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["decision", selectedId] }),
        qc.invalidateQueries({ queryKey: ["decision-timeline", selectedId] }),
        qc.invalidateQueries({ queryKey: ["decisions"] }),
      ]);
      Alert.alert("Future scenarios updated", result.generated_events + " conditional events were added across your decision paths.");
    },
    onError: (error) => Alert.alert("Scenario generation unavailable", error.response?.data?.detail || error.message),
  });

  const decision = detailQuery.data;
  const alternatives = alternativesText.split("\n").map((item) => item.trim()).filter(Boolean);
  const alternativeCount = alternatives.length;
  const hasUniqueAlternatives = new Set(alternatives.map((item) => item.toLocaleLowerCase())).size === alternativeCount;
  const canCreateDecision = title.trim().length >= 3 && context.trim().length >= 10 && alternativeCount >= 2 && hasUniqueAlternatives && !createMutation.isPending;
  const timeline = timelineQuery.data;
  const branches = useMemo(() => timeline?.alternatives || [], [timeline]);
  const panel = { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 18 };
  const text = (size = 14, weight = "400", color = c.text.primary) => ({ color, fontSize: size, fontWeight: weight });

  const goBack = () => {
    if (mode === "detail") { setMode("list"); setSelectedId(null); }
    else setMode("list");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 12 }}>
          <Pressable onPress={goBack} style={{ width: 40, height: 40, borderRadius: 13, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", backgroundColor: c.card }}>
            <Ionicons name="arrow-back" size={19} color={c.text.primary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={text(19, "900")}>Decision Intelligence</Text>
            <Text style={text(11, "600", c.text.muted)}>Explore paths. Revisit as life changes.</Text>
          </View>
          {mode === "list" ? <Pressable onPress={() => setMode("create")} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={23} color="#fff" /></Pressable> : null}
        </View>

        {mode === "list" ? (
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 14 }} refreshControl={<RefreshControl refreshing={listQuery.isRefetching} onRefresh={() => listQuery.refetch()} tintColor={c.primary} />}>
            <View style={[panel, { padding: 18, backgroundColor: c.surface }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 9 }}>
                <Ionicons name="git-network-outline" size={20} color={c.primary} />
                <Text style={text(15, "800")}>See beyond the immediate choice</Text>
              </View>
              <Text style={text(12, "400", c.text.secondary)}>Compare alternatives on a time-based timeline. Add opportunities, risks, deadlines, and new decision points whenever circumstances change.</Text>
              <Text style={[text(11, "700", c.text.muted), { marginTop: 12 }]}>No made-up success scores or probability percentages.</Text>
            </View>
            {listQuery.isLoading ? <ActivityIndicator color={c.primary} style={{ marginTop: 30 }} /> : null}
            {listQuery.isError ? <View style={[panel, { padding: 18 }]}><Text style={text(13, "700", c.error)}>Could not load decisions.</Text><Text style={text(12, "400", c.text.secondary)}>Check your connection and try again.</Text><Pressable onPress={() => listQuery.refetch()}><Text style={[text(12, "800", c.primary), { marginTop: 10 }]}>Retry</Text></Pressable></View> : null}
            {!listQuery.isLoading && (listQuery.data || []).length === 0 ? (
              <View style={[panel, { padding: 24, alignItems: "center" }]}>
                <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: c.surfaceHover, alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Ionicons name="git-branch-outline" size={27} color={c.primary} /></View>
                <Text style={text(16, "800")}>Your first decision starts here</Text>
                <Text style={[text(12, "400", c.text.muted), { textAlign: "center", marginTop: 7, marginBottom: 16 }]}>Create a decision and map what could unfold over the coming weeks or months.</Text>
                <ActionButton label="Create a decision" icon="add" onPress={() => setMode("create")} colors={c} />
              </View>
            ) : null}
            {(listQuery.data || []).map((item) => (
              <Pressable key={item.id} onPress={() => { setSelectedId(item.id); setMode("detail"); }}>
                <View style={[panel, { padding: 16 }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[text(15, "800"), { flex: 1, marginRight: 10 }]} numberOfLines={2}>{item.title}</Text>
                    <View style={{ borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: c.surfaceHover }}><Text style={text(10, "800", c.primary)}>{item.status}</Text></View>
                  </View>
                  <Text style={[text(12, "400", c.text.secondary), { marginTop: 7 }]} numberOfLines={2}>{item.context}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 13, gap: 14 }}>
                    <Text style={text(11, "700", c.text.muted)}>{item.alternatives?.length || 0} paths</Text>
                    <Text style={text(11, "700", c.text.muted)}>{Math.ceil((item.horizon_days || 30) / 30)} month horizon</Text>
                    <View style={{ flex: 1 }} />
                    <Ionicons name="chevron-forward" size={17} color={c.text.muted} />
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {mode === "create" ? (
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 28 }}>
            <View style={[panel, { padding: 17, marginBottom: 14 }]}>
              <Text style={text(16, "900")}>What decision are you facing?</Text>
              <Text style={[text(12, "400", c.text.muted), { marginTop: 5, marginBottom: 17 }]}>Describe the real situation. Include constraints and what matters to you.</Text>
              <Field label="Decision title" value={title} onChangeText={setTitle} placeholder="e.g. Continue internship or leave?" colors={c} />
              <Field label="Situation and context" value={context} onChangeText={setContext} placeholder="Explain the situation, goals, deadlines, financial or personal constraints..." multiline colors={c} />
              <Field label="Possible paths (one per line, minimum two)" value={alternativesText} onChangeText={setAlternativesText} placeholder={"Stay\nLeave"} multiline colors={c} />
              <Field label="Planning horizon (months)" value={horizon} onChangeText={setHorizon} placeholder="3" keyboardType="number-pad" colors={c} />
              <Field label="Uncertainties (optional, one per line)" value={uncertaintiesText} onChangeText={setUncertaintiesText} placeholder={"Will I receive a campus offer?\nWill the company offer full-time?"} multiline colors={c} />
            </View>
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background }}>
            <ActionButton
              label={createMutation.isPending ? "Creating timeline..." : "Create decision timeline"}
              icon="git-branch-outline"
              onPress={() => createMutation.mutate()}
              colors={c}
              disabled={!canCreateDecision}
            />
            <Text style={[text(10, "500", c.text.muted), { textAlign: "center", marginTop: 6 }]}>
              {alternativeCount < 2 ? "Add at least two paths." : !hasUniqueAlternatives ? "Each path must have a different name." : title.trim().length < 3 ? "Enter a title with at least 3 characters." : context.trim().length < 10 ? "Add at least 10 characters of context." : "Your decision is ready to map."}
            </Text>
          </View>
        ) : null}

        {mode === "detail" ? (
          detailQuery.isLoading || timelineQuery.isLoading ? <ActivityIndicator color={c.primary} style={{ marginTop: 60 }} /> :
          detailQuery.isError ? <View style={{ padding: 24 }}><Text style={text(14, "700", c.error)}>Could not load this decision.</Text><ActionButton label="Try again" onPress={() => { detailQuery.refetch(); timelineQuery.refetch(); }} colors={c} /></View> :
          decision ? (
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 2, gap: 14 }} refreshControl={<RefreshControl refreshing={detailQuery.isRefetching || timelineQuery.isRefetching} onRefresh={() => { detailQuery.refetch(); timelineQuery.refetch(); }} tintColor={c.primary} />}>
              <View style={[panel, { padding: 17 }]}>
                <Text style={text(17, "900")}>{decision.title}</Text>
                <Text style={[text(12, "400", c.text.secondary), { marginTop: 8, lineHeight: 19 }]}>{decision.context}</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 13 }}>
                  <View style={{ backgroundColor: c.surfaceHover, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 }}><Text style={text(10, "800", c.primary)}>{Math.ceil((decision.horizon_days || 30) / 30)} month horizon</Text></View>
                  <View style={{ backgroundColor: c.surfaceHover, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 }}><Text style={text(10, "800", c.text.secondary)}>{decision.status}</Text></View>
                </View>
              </View>

              <View style={[panel, { padding: 16 }]}>
                <Text style={text(14, "900")}>Possible paths</Text>
                <Text style={[text(11, "400", c.text.muted), { marginTop: 4, marginBottom: 12 }]}>Choose a path to record your current decision. You can revisit it later.</Text>
                {decision.alternatives.map((alt) => {
                  const active = decision.selected_alternative === alt.name;
                  return <Pressable key={alt.name} onPress={() => chooseMutation.mutate(alt.name)} style={{ borderWidth: 1, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary + "15" : c.surface, padding: 12, borderRadius: 13, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={18} color={active ? c.primary : c.text.muted} />
                    <Text style={[text(13, "700"), { flex: 1 }]}>{alt.name}</Text>
                    {active ? <Text style={text(10, "800", c.primary)}>CURRENT CHOICE</Text> : null}
                  </Pressable>;
                })}
              </View>

              <View style={[panel, { padding: 12 }]}>
                <View style={{ paddingHorizontal: 4, marginBottom: 12 }}>
                  <Text style={text(14, "900")}>Explore the multiverse</Text>
                  <Text style={[text(11, "400", c.text.muted), { marginTop: 4 }]}>Follow each possibility, then split a reality at any decision point.</Text>
                </View>
                <View style={{ marginBottom: 13 }}>
                  <ActionButton
                    label={simulateMutation.isPending ? "Opening possible realities..." : "Generate alternate realities"}
                    icon="sparkles"
                    onPress={() => simulateMutation.mutate()}
                    colors={c}
                    disabled={simulateMutation.isPending}
                  />
                  <Text style={[text(10, "500", c.text.muted), { marginTop: 7 }]}>AI-generated branches are hypothetical. Regenerating replaces prior AI scenarios but preserves events you added.</Text>
                </View>
                {timelineQuery.isError ? (
                  <View style={{ padding: 12, borderRadius: 12, backgroundColor: c.surfaceHover, marginBottom: 12 }}>
                    <Text style={text(11, "700", c.error)}>The timeline could not be loaded.</Text>
                    <Pressable onPress={() => timelineQuery.refetch()}><Text style={[text(11, "800", c.primary), { marginTop: 6 }]}>Retry timeline</Text></Pressable>
                  </View>
                ) : null}
                <MultiverseTree
                  title={decision.title}
                  branches={branches}
                  selectedAlternative={decision.selected_alternative}
                  onSelectFollowUp={(payload) => followUpMutation.mutate(payload)}
                  followUpPending={followUpMutation.isPending}
                  colors={c}
                />
                <Text style={[text(10, "500", c.text.muted), { marginTop: 9, lineHeight: 15 }]}>{timeline?.methodology?.note || "This map explores possible paths. It does not predict which outcome will happen."}</Text>
              </View>

              <View style={[panel, { padding: 16 }]}>
                <Text style={text(14, "900")}>Update the future</Text>
                <Text style={[text(11, "400", c.text.muted), { marginTop: 4, marginBottom: 13 }]}>Add an opportunity, risk, deadline, or new decision point. It will appear in the relevant timeline.</Text>
                <Field label="Event title" value={eventTitle} onChangeText={setEventTitle} placeholder="e.g. Campus placement offer arrives" colors={c} />
                <Field label="Details (optional)" value={eventDescription} onChangeText={setEventDescription} placeholder="What might happen or what changed?" multiline colors={c} />
                <Field label="Approximate timing (weeks from now)" value={eventDay} onChangeText={setEventDay} placeholder="4" keyboardType="number-pad" colors={c} />
                {eventType === "decision" ? <Field label="Possible next choices (one per line)" value={followUpOptionsText} onChangeText={setFollowUpOptionsText} placeholder={"Accept the new offer\nStay with the current company"} multiline colors={c} /> : null}
                <Text style={[text(11, "700", c.text.secondary), { marginBottom: 7 }]}>Event type</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
                  {Object.entries(TYPES).map(([key, value]) => <Pressable key={key} onPress={() => setEventType(key)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: eventType === key ? c.primary : c.border, backgroundColor: eventType === key ? c.primary + "18" : c.surface }}><Text style={text(10, "700", eventType === key ? c.primary : c.text.secondary)}>{value.label}</Text></Pressable>)}
                </View>
                <Text style={[text(11, "700", c.text.secondary), { marginBottom: 7 }]}>Apply to path</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
                  <Pressable onPress={() => setEventAlternative("*")} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: eventAlternative === "*" ? c.primary : c.border, backgroundColor: eventAlternative === "*" ? c.primary + "18" : c.surface }}><Text style={text(10, "700", eventAlternative === "*" ? c.primary : c.text.secondary)}>All paths</Text></Pressable>
                  {decision.alternatives.map((alt) => <Pressable key={alt.name} onPress={() => setEventAlternative(alt.name)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: eventAlternative === alt.name ? c.primary : c.border, backgroundColor: eventAlternative === alt.name ? c.primary + "18" : c.surface }}><Text style={text(10, "700", eventAlternative === alt.name ? c.primary : c.text.secondary)} numberOfLines={1}>{alt.name}</Text></Pressable>)}
                </View>
                <ActionButton label={eventMutation.isPending ? "Adding..." : "Add timeline event"} icon="add-circle-outline" onPress={() => {
                  const options = followUpOptionsText.split("\n").map((item) => item.trim()).filter(Boolean);
                  if (eventType === "decision" && options.length < 2) {
                    Alert.alert("Add follow-up choices", "A decision point needs at least two choices, one per line.");
                    return;
                  }
                  if (!Number.isFinite(Number(eventDay)) || Number(eventDay) < 0) {
                    Alert.alert("Check the timing", "Enter a valid number of weeks from now.");
                    return;
                  }
                  eventMutation.mutate();
                }} colors={c} disabled={eventMutation.isPending || !eventTitle.trim()} />
              </View>

              {decision.uncertainties?.length ? <View style={[panel, { padding: 16 }]}><Text style={text(13, "900")}>Things still uncertain</Text>{decision.uncertainties.map((item, i) => <Text key={i} style={[text(12, "400", c.text.secondary), { marginTop: 7 }]}>• {item}</Text>)}</View> : null}
            </ScrollView>
          ) : null
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
