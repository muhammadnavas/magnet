import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import ProcessingIndicator from "../../components/knowledge/ProcessingIndicator";
import useKnowledgeStore from "../../store/knowledgeStore";
import Card from "../../components/ui/Card";
import Logo from "../../components/ui/Logo";
import { useAppTheme } from "../../store/themeStore";

export default function CaptureScreen() {
  const store = useKnowledgeStore();
  const { themeColors } = useAppTheme();
  const params = useLocalSearchParams();
  const [inputText, setInputText] = useState("");
  const [processingState, setProcessingState] = useState(null);
  const [recentSaved, setRecentSaved] = useState([]);

  useEffect(() => {
    if (params.selectType === "pdf") {
      router.setParams({ selectType: undefined });
      handlePdfUpload();
    } else if (params.selectType === "image") {
      router.setParams({ selectType: undefined });
      handlePhotoUpload();
    } else if (params.selectType === "camera") {
      router.setParams({ selectType: undefined });
      handleCapturePhoto();
    }
  }, [params.selectType]);

  const detectContentType = (rawText) => {
    const t = rawText.trim();
    if (/^https?:\/\/\S+$/i.test(t)) return "url";
    if (/(?:def |function |const |let |var |import |export |class |;\s*\n|\(\)=>)/i.test(t)) return "code";
    if (/error|exception|traceback|failed|crash/i.test(t)) return "error";
    return "note";
  };

  useEffect(() => {
    store.fetchItems();
  }, []);

  const triggerIngestionFlow = async (title, type, rawContent, fileAsset = null) => {
    setProcessingState({ progress: 20, message: "Uploading to secure storage..." });
    try {
      const item = {
        title,
        contentType: type,
        summary: `Captured ${type} item.`,
        rawContent,
        file: fileAsset ? {
          uri: fileAsset.uri,
          name: fileAsset.name || title,
          type: fileAsset.mimeType || (type === "image" ? "image/jpeg" : "application/pdf")
        } : null
      };

      setProcessingState({ progress: 65, message: "Extracting text & generating vector embeddings..." });
      await store.addKnowledgeItem(item);
      setRecentSaved(prev => [item, ...prev]);
      setProcessingState({ progress: 100, message: "Completed!" });
      setTimeout(() => setProcessingState(null), 400);
      Alert.alert("Cataloged!", `"${title}" has been saved, vectorized, and is ready for AI Q&A.`);
    } catch (e) {
      console.error("Ingestion failed:", e);
      setProcessingState(null);
      Alert.alert("Upload Error", "Could not complete document ingestion.");
    }
  };

  const handlePdfUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets?.length > 0) {
        const asset = res.assets[0];
        triggerIngestionFlow(asset.name, "pdf", `Extracted content from PDF: ${asset.name}`, asset);
      }
    } catch (err) {
      console.error("PDF selection failed:", err);
      Alert.alert("Upload Error", "Could not select the PDF.");
    }
  };

  const handlePhotoUpload = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Denied", "Photo library access is required to upload a photo.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsEditing: false,
      });

      if (!res.canceled && res.assets?.length > 0) {
        const asset = res.assets[0];
        const filename = asset.fileName || asset.uri.split("/").pop() || "photo.jpg";
        triggerIngestionFlow(filename, "image", "OCR extracted from uploaded photo.", {
          ...asset,
          name: filename,
          mimeType: asset.mimeType || "image/jpeg",
        });
      }
    } catch (err) {
      console.error("Photo selection failed:", err);
      Alert.alert("Upload Error", "Could not select the photo.");
    }
  };

  const handleCapturePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Denied", "Camera access is required to capture a photo.");
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsEditing: false,
      });

      if (!res.canceled && res.assets?.length > 0) {
        const asset = res.assets[0];
        const filename = asset.fileName || `photo-${Date.now()}.jpg`;
        triggerIngestionFlow(filename, "image", "OCR extracted from captured photo.", {
          ...asset,
          name: filename,
          mimeType: asset.mimeType || "image/jpeg",
        });
      }
    } catch (err) {
      console.error("Camera capture failed:", err);
      Alert.alert("Camera Error", "Could not capture the photo.");
    }
  };

  const handleCapture = async () => {
    if (!inputText.trim()) return;
    const raw = inputText.trim();
    const type = detectContentType(raw);
    const firstLine = raw.split("\n")[0].replace(/^[#*-\s]+/, "");
    const title = firstLine.slice(0, 50) + (firstLine.length > 50 ? "..." : "");
    const item = { title, contentType: type, summary: raw.slice(0, 120) + (raw.length > 120 ? "..." : ""), rawContent: raw };
    await store.addKnowledgeItem(item);
    setRecentSaved(prev => [item, ...prev]);
    setInputText("");
  };

  if (processingState) {
    return (
      <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1 justify-center p-6">
        <ProcessingIndicator progress={processingState.progress} statusMessage={processingState.message} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 justify-between">
        <ScrollView
          className="flex-1 px-5 pt-10"
          contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center", paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >

          {/* Hero */}
          <View className="items-center mt-8 mb-10">
            <Logo size="lg" showText={false} className="mb-4" />
            <Text style={{ color: themeColors.text.primary }} className="text-3xl font-black text-center mb-2 tracking-tight">Where should we begin?</Text>
            <Text style={{ color: themeColors.text.secondary }} className="text-sm text-center max-w-[300px] leading-relaxed">
              Capture any text, code snippet, link, or document instantly into your AI library.
            </Text>
          </View>

          {/* Upload / Camera Buttons */}
          <View className="flex-row flex-wrap justify-center gap-2 mb-10">
            <TouchableOpacity
              onPress={handlePdfUpload}
              style={{ backgroundColor: themeColors.card, borderColor: themeColors.border, flexGrow: 1, flexShrink: 1, minWidth: 145 }}
              className="flex-row items-center justify-center border px-4 py-2.5 rounded-full"
            >
              <Ionicons name="document-text-outline" size={16} color={themeColors.primary} style={{ marginRight: 6 }} />
              <Text style={{ color: themeColors.text.primary }} className="text-sm font-semibold">Upload PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePhotoUpload}
              style={{ backgroundColor: themeColors.card, borderColor: themeColors.border, flexGrow: 1, flexShrink: 1, minWidth: 145 }}
              className="flex-row items-center justify-center border px-4 py-2.5 rounded-full"
            >
              <Ionicons name="image-outline" size={16} color={themeColors.primary} style={{ marginRight: 6 }} />
              <Text style={{ color: themeColors.text.primary }} className="text-sm font-semibold">Upload Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCapturePhoto}
              style={{ backgroundColor: themeColors.card, borderColor: themeColors.border, flexGrow: 1, flexShrink: 1, minWidth: 145 }}
              className="flex-row items-center justify-center border px-4 py-2.5 rounded-full"
            >
              <Ionicons name="camera-outline" size={16} color={themeColors.primary} style={{ marginRight: 6 }} />
              <Text style={{ color: themeColors.text.primary }} className="text-sm font-semibold">Capture Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Captures */}
          {recentSaved.length > 0 && (
            <View className="mb-8">
              <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-3">Just Captured</Text>
              {recentSaved.slice(0, 3).map((item, idx) => (
                <Card key={idx} className="p-3.5 flex-row items-center justify-between mb-2">
                  <View className="flex-1 mr-3">
                    <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold" numberOfLines={1}>{item.title}</Text>
                    <Text style={{ color: themeColors.text.muted }} className="text-[11px] mt-0.5" numberOfLines={1}>{item.summary}</Text>
                  </View>
                  <View style={{ backgroundColor: themeColors.surfaceHover }} className="px-2.5 py-1 rounded-full border border-neutral-700/30">
                    <Text style={{ color: themeColors.text.muted }} className="text-[10px] font-bold uppercase">{item.contentType}</Text>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Floating Input Bar */}
        <View style={{ backgroundColor: themeColors.background, borderTopColor: themeColors.border }} className="px-4 pt-3 pb-4 border-t">
          <View
            style={{ backgroundColor: themeColors.card, borderColor: themeColors.border, width: "100%", maxWidth: 760, alignSelf: "center" }}
            className="flex-row items-center border rounded-3xl p-2.5 px-3"
          >
            <TouchableOpacity
              onPress={() => Alert.alert("Upload", "Choose source:", [
                { text: "PDF", onPress: handlePdfUpload },
                { text: "Photo Library", onPress: handlePhotoUpload },
                { text: "Camera", onPress: handleCapturePhoto },
                { text: "Cancel", style: "cancel" }
              ])}
              style={{ backgroundColor: themeColors.surfaceHover, borderColor: themeColors.border }}
              className="w-9 h-9 rounded-full items-center justify-center mr-2 border"
            >
              <Ionicons name="add" size={22} color={themeColors.primary} />
            </TouchableOpacity>

            <TextInput
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleCapture}
              placeholder="Capture anything... notes, URLs, code, or logs"
              placeholderTextColor={themeColors.text.muted}
              className="flex-1 text-base px-1"
              returnKeyType="send"
              blurOnSubmit
              style={{ color: themeColors.text.primary, paddingTop: Platform.OS === "ios" ? 8 : 4, paddingBottom: Platform.OS === "ios" ? 8 : 4 }}
            />

            <TouchableOpacity
              onPress={handleCapture}
              disabled={!inputText.trim()}
              style={{ backgroundColor: inputText.trim() ? themeColors.primary : themeColors.border }}
              className="w-9 h-9 rounded-full items-center justify-center ml-2"
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
