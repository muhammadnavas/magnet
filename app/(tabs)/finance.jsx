import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View, NativeModules } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import api from "../../lib/api";
import { useAppTheme } from "../../store/themeStore";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
const currentLocalMonth = () => { const now = new Date(); return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0"); };

export default function FinanceScreen() {
  const { themeColors } = useAppTheme();
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionEnabled, setPermissionEnabled] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [limits, setLimits] = useState([]);
  const [limitAmount, setLimitAmount] = useState("");
  const [limitCategory, setLimitCategory] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [selectedMonth] = useState(currentLocalMonth);
  const timezoneOffset = new Date().getTimezoneOffset();

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [s, t, l] = await Promise.all([api.get("/finance/summary?month=" + selectedMonth + "&tz_offset_minutes=" + timezoneOffset), api.get("/finance/transactions?month=" + selectedMonth + "&tz_offset_minutes=" + timezoneOffset + "&limit=100"), api.get("/finance/limits")]);
      setSummary(s.data); setTransactions(t.data || []); setLimits(l.data || []);
    } catch (error) {
      Alert.alert("Finance unavailable", error?.response?.data?.detail || "Could not load finance data. Check the backend and database migration.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [selectedMonth]);

  const checkPermission = useCallback(async () => {
    if (Platform.OS !== "android" || !NativeModules.MagnetFinance) { setPermissionEnabled(false); return; }
    try { setPermissionEnabled(Boolean(await NativeModules.MagnetFinance.isNotificationAccessEnabled())); }
    catch (_) { setPermissionEnabled(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    checkPermission();
    const subscription = require("react-native").AppState.addEventListener("change", (state) => { if (state === "active") checkPermission(); });
    return () => subscription.remove();
  }, [load, checkPermission]));

  const openPermission = async () => {
    if (Platform.OS !== "android") { Alert.alert("Android only", "Automatic payment notification capture is currently available on Android."); return; }
    try {
      if (NativeModules.MagnetFinance) await NativeModules.MagnetFinance.openNotificationAccessSettings();
      else await Linking.sendIntent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
    } catch (_) { Alert.alert("Permission settings", "Open Android Settings → Notifications → Device & app notifications → Magnet, then enable notification access."); }
  };


  const enableSpendingAlerts = async () => {
    if (Platform.OS === "web") { Alert.alert("Mobile only", "Push alerts are available in the Android app."); return; }
    setPushBusy(true);
    try {
      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;
      if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
      if (status !== "granted") { Alert.alert("Permission required", "Allow notifications for Magnet to receive spending alerts."); return; }
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("finance-alerts", {
          name: "Spending alerts", importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });
      }
      const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) throw new Error("Expo project ID is missing from app configuration.");
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      await api.post("/finance/push-token", { expo_push_token: token, platform: Platform.OS });
      setPushEnabled(true);
      Alert.alert("Spending alerts enabled", "Magnet can now send backend spending-threshold notifications.");
    } catch (error) {
      Alert.alert("Could not enable alerts", error?.response?.data?.detail || error.message || "Please try again.");
    } finally { setPushBusy(false); }
  };

  const saveLimit = async () => {
    const amount = Number(limitAmount);
    if (!Number.isFinite(amount) || amount <= 0) { Alert.alert("Invalid amount", "Enter a spending limit greater than zero."); return; }
    setSavingLimit(true);
    try {
      await api.put("/finance/limits", {
        amount, category: limitCategory.trim() || null, enabled: true,
        timezone_offset_minutes: new Date().getTimezoneOffset(),
      });
      setLimitAmount(""); setLimitCategory("");
      const response = await api.get("/finance/limits");
      setLimits(response.data || []);
      Alert.alert("Limit saved", "Magnet will check this limit whenever a new payment is captured.");
    } catch (error) {
      Alert.alert("Could not save limit", error?.response?.data?.detail || "Please try again.");
    } finally { setSavingLimit(false); }
  };

  const removeLimit = async (id) => {
    try {
      await api.delete("/finance/limits/" + id);
      setLimits((current) => current.filter((item) => item.id !== id));
    } catch (error) { Alert.alert("Could not remove limit", error?.response?.data?.detail || "Please try again."); }
  };

  const ask = async () => {
    if (!question.trim()) return;
    setAsking(true); setAnswer("");
    try { const result = await api.post("/finance/ask", { question: question.trim() }); setAnswer(result.data.answer); }
    catch (error) { setAnswer(error?.response?.data?.detail || "I couldn't analyse your transactions right now."); }
    finally { setAsking(false); }
  };

  const categories = summary?.category_breakdown || [];
  const maxCategory = Math.max(1, ...categories.map((item) => Number(item.amount)));
  const card = { backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1, borderRadius: 18, padding: 16 };
  const muted = themeColors.text.muted, primary = themeColors.text.primary, secondary = themeColors.text.secondary;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={themeColors.primary} />}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <View><Text style={{ color: themeColors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 2 }}>MONEY OVERVIEW</Text><Text style={{ color: primary, fontSize: 27, fontWeight: "900", marginTop: 3 }}>Finance</Text><Text style={{ color: muted, fontSize: 12, marginTop: 3 }}>Your spending, understood.</Text></View>
          <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: themeColors.primary + "20", alignItems: "center", justifyContent: "center" }}><Ionicons name="wallet-outline" size={24} color={themeColors.primary} /></View>
        </View>
        <Pressable onPress={openPermission} style={{ ...card, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 12, borderColor: permissionEnabled ? "#05966970" : themeColors.border }}>
          <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: permissionEnabled ? "#05966920" : themeColors.primary + "18", alignItems: "center", justifyContent: "center" }}><Ionicons name={permissionEnabled ? "shield-checkmark-outline" : "notifications-outline"} size={21} color={permissionEnabled ? "#10B981" : themeColors.primary} /></View>
          <View style={{ flex: 1 }}><Text style={{ color: primary, fontSize: 14, fontWeight: "800" }}>{permissionEnabled ? "Payment capture is enabled" : "Enable automatic payment tracking"}</Text><Text style={{ color: muted, fontSize: 11, marginTop: 3 }}>{permissionEnabled ? "Tap to review Android notification access" : "Allow Magnet to detect supported payment alerts"}</Text></View><Ionicons name="chevron-forward" size={18} color={muted} />
        </Pressable>
        {loading ? <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={themeColors.primary} /></View> : <>
          <View style={{ ...card, marginBottom: 12 }}>
            <Text style={{ color: muted, fontSize: 12, fontWeight: "700" }}>TOTAL SPENT · {summary?.month || selectedMonth}</Text>
            <Text style={{ color: primary, fontSize: 32, fontWeight: "900", marginTop: 7 }}>{money(summary?.expense)}</Text>
            <View style={{ flexDirection: "row", gap: 20, marginTop: 16 }}>
              <View style={{ flex: 1 }}><Text style={{ color: muted, fontSize: 11 }}>Money received</Text><Text style={{ color: "#10B981", fontSize: 17, fontWeight: "800", marginTop: 4 }}>{money(summary?.income)}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ color: muted, fontSize: 11 }}>Net cash flow</Text><Text style={{ color: primary, fontSize: 17, fontWeight: "800", marginTop: 4 }}>{money(summary?.net)}</Text></View>
            </View>
            <Text style={{ color: muted, fontSize: 10, marginTop: 14 }}>{summary?.transaction_count || 0} captured transactions · Based on notifications Magnet received</Text>
          </View>
          <View style={{ ...card, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <View><Text style={{ color: primary, fontSize: 16, fontWeight: "800" }}>Spending limits</Text><Text style={{ color: muted, fontSize: 11, marginTop: 3 }}>Backend alerts at 50%, 80% and 100%</Text></View>
              <Ionicons name="speedometer-outline" size={21} color={themeColors.primary} />
            </View>
            <Pressable onPress={enableSpendingAlerts} disabled={pushBusy} style={{ borderWidth: 1, borderColor: pushEnabled ? "#05966970" : themeColors.border, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 14, opacity: pushBusy ? 0.6 : 1 }}>
              <Ionicons name={pushEnabled ? "notifications" : "notifications-outline"} size={18} color={pushEnabled ? "#10B981" : themeColors.primary} />
              <Text style={{ color: primary, fontSize: 12, fontWeight: "700", marginLeft: 9, flex: 1 }}>{pushBusy ? "Enabling notifications..." : pushEnabled ? "Push alerts registered on this device" : "Enable spending notifications"}</Text>
              {!pushEnabled && <Ionicons name="chevron-forward" size={17} color={muted} />}
            </Pressable>
            <Text style={{ color: secondary, fontSize: 12, fontWeight: "700", marginBottom: 7 }}>Set a monthly limit</Text>
            <TextInput value={limitAmount} onChangeText={setLimitAmount} keyboardType="decimal-pad" placeholder="Limit amount (₹)" placeholderTextColor={muted} style={{ color: primary, borderColor: themeColors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13, marginBottom: 8 }} />
            <TextInput value={limitCategory} onChangeText={setLimitCategory} placeholder="Category (optional; blank = overall)" placeholderTextColor={muted} style={{ color: primary, borderColor: themeColors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13 }} />
            <Pressable onPress={saveLimit} disabled={savingLimit} style={{ marginTop: 9, backgroundColor: themeColors.primary, borderRadius: 12, padding: 12, alignItems: "center", opacity: savingLimit ? 0.6 : 1 }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 13 }}>{savingLimit ? "Saving..." : "Save spending limit"}</Text>
            </Pressable>
            {limits.length > 0 && <View style={{ marginTop: 15 }}>
              {limits.map((item) => {
                const spent = item.category ? Number(categories.find((entry) => entry.category === item.category)?.amount || 0) : Number(summary?.expense || 0);
                const percent = Math.min(100, spent / Number(item.amount) * 100);
                const tone = percent >= 100 ? "#EF4444" : percent >= 80 ? "#F59E0B" : "#10B981";
                return <View key={item.id} style={{ paddingTop: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: themeColors.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}><Text style={{ color: primary, fontSize: 13, fontWeight: "800" }}>{item.category || "Overall monthly spending"}</Text><Text style={{ color: muted, fontSize: 11, marginTop: 3 }}>{money(spent)} of {money(item.amount)} · {Math.round(percent)}%</Text></View>
                    <Pressable onPress={() => removeLimit(item.id)} hitSlop={10}><Ionicons name="trash-outline" size={17} color={muted} /></Pressable>
                  </View>
                  <View style={{ height: 7, borderRadius: 8, backgroundColor: themeColors.surfaceHover, overflow: "hidden", marginTop: 9 }}><View style={{ height: 7, width: percent + "%", backgroundColor: tone, borderRadius: 8 }} /></View>
                </View>;
              })}
            </View>}
          </View>
          <View style={{ ...card, marginBottom: 12 }}>
            <Text style={{ color: primary, fontSize: 16, fontWeight: "800", marginBottom: 14 }}>Spending by category</Text>
            {categories.length ? categories.map((item) => <View key={item.category} style={{ marginBottom: 13 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}><Text style={{ color: secondary, fontSize: 12 }}>{item.category}</Text><Text style={{ color: primary, fontSize: 12, fontWeight: "700" }}>{money(item.amount)}</Text></View>
              <View style={{ height: 7, borderRadius: 8, backgroundColor: themeColors.surfaceHover, overflow: "hidden" }}><View style={{ height: 7, width: Math.max(2, Number(item.amount) / maxCategory * 100) + "%", borderRadius: 8, backgroundColor: themeColors.primary }} /></View>
            </View>) : <Text style={{ color: muted, fontSize: 12 }}>No expenses captured this month yet.</Text>}
          </View>
          <View style={{ ...card, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}><Ionicons name="sparkles" color={themeColors.primary} size={18} /><Text style={{ color: primary, fontSize: 16, fontWeight: "800", marginLeft: 8 }}>Ask your finance analyst</Text></View>
            <TextInput value={question} onChangeText={setQuestion} placeholder="How much did I spend on food?" placeholderTextColor={muted} style={{ color: primary, borderColor: themeColors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontSize: 13 }} />
            <Pressable onPress={ask} disabled={asking || !question.trim()} style={{ marginTop: 10, backgroundColor: themeColors.primary, borderRadius: 12, padding: 12, alignItems: "center", opacity: asking || !question.trim() ? 0.55 : 1 }}><Text style={{ color: "#FFF", fontWeight: "800", fontSize: 13 }}>{asking ? "Analysing..." : "Analyse spending"}</Text></Pressable>
            {answer ? <Text style={{ color: secondary, fontSize: 13, lineHeight: 20, marginTop: 12 }}>{answer}</Text> : <Text style={{ color: muted, fontSize: 11, marginTop: 10 }}>Ask about food, travel, shopping, income or your largest expense.</Text>}
          </View>
          <View style={card}>
            <Text style={{ color: primary, fontSize: 16, fontWeight: "800", marginBottom: 12 }}>Recent transactions</Text>
            {transactions.length ? transactions.slice(0, 30).map((item) => <View key={item.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: themeColors.border }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: themeColors.surfaceHover, alignItems: "center", justifyContent: "center", marginRight: 11 }}><Ionicons name={item.transaction_type === "income" ? "arrow-down" : "arrow-up"} size={17} color={item.transaction_type === "income" ? "#10B981" : secondary} /></View>
              <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: primary, fontSize: 13, fontWeight: "700" }}>{item.merchant}</Text><Text style={{ color: muted, fontSize: 10, marginTop: 3 }}>{item.category} · {item.source_app} · {new Date(item.occurred_at).toLocaleDateString()}</Text></View>
              <Text style={{ color: item.transaction_type === "income" ? "#10B981" : primary, fontSize: 13, fontWeight: "800" }}>{item.transaction_type === "income" ? "+" : "−"}{money(item.amount)}</Text>
            </View>) : <Text style={{ color: muted, fontSize: 12 }}>Captured payments will appear here after notification access is enabled.</Text>}
          </View>
        </>}
        <Text style={{ color: muted, fontSize: 10, lineHeight: 16, marginTop: 14 }}>Privacy: Magnet forwards only likely payment alerts from supported apps. It does not store OTPs or unrelated notification content. Alerts can be missing or misclassified; verify important totals against your bank statement.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
