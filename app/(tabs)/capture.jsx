import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import ProcessingIndicator from "../../components/knowledge/ProcessingIndicator";
import useKnowledgeStore from "../../store/knowledgeStore";
import Card from "../../components/ui/Card";
import Tag from "../../components/ui/Tag";
import Logo from "../../components/ui/Logo";
import useThemeStore from "../../store/themeStore";

export default function CaptureScreen() {
  const store = useKnowledgeStore();
  const { colors: themeColors } = useThemeStore();
  const params = useLocalSearchParams();
  const [inputText, setInputText] = useState("");
  const [processingState, setProcessingState] = useState(null);
  const [recentSaved, setRecentSaved] = useState([]);

  useEffect(() => {
    if (params.selectType === "pdf") handlePdfUpload();
    if (params.selectType === "image") handleImageUpload();
  }, [params.selectType]);

  const detectContentType = (rawText) => {
    const trimmed = rawText.trim();
    if (/^https?:\/\/\S+$/i.test(trimmed) || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return "url";
    }
    if (/(?:def |function |const |let |var |import |export |class |<[a-z]+|{\s*\n|;\s*\n|\(\)=>)/i.test(trimmed)) {
      return "code";
    }
    if (/error|exception|traceback|failed|crash|stack|unhandled/i.test(trimmed)) {
      return "error";
    }
    return "note";
  };

  const handlePdfUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        triggerIngestionFlow(asset.name, "pdf", `Extracted text content from PDF file: ${asset.name}`);
      }
    } catch (err) {
      console.error("Document Picker Error:", err);
    }
  };

  const handleImageUpload = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Denied", "Library access permissions are required to upload screenshots.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const filename = asset.uri.split("/").pop();
        triggerIngestionFlow(filename || "screenshot.png", "image", "OCR extracted text from uploaded image.");
      }
    } catch (err) {
      console.error("Image Picker Error:", err);
    }
  };

  const triggerIngestionFlow = (itemTitle, itemType, rawContent) => {
    setProcessingState({ progress: 15, message: "Uploading document payload..." });

    let currentProgress = 15;
    const interval = setInterval(() => {
      currentProgress += 25;
      
      let message = "Parsing text payload...";
      if (currentProgress > 40) message = "AI classification & tagging...";
      if (currentProgress > 80) message = "Generating vector embeddings...";

      if (currentProgress >= 100) {
        clearInterval(interval);
        setProcessingState(null);
        
        const newItem = {
          title: itemTitle,
          contentType: itemType,
          summary: `Captured ${itemType} item in library.`,
          tags: ["imported", itemType],
          project: "Personal Projects",
          rawContent,
        };

        store.addKnowledgeItem(newItem);
        setRecentSaved((prev) => [newItem, ...prev]);
        Alert.alert("Saved to Library", `"${itemTitle}" was cataloged successfully.`);
      } else {
        setProcessingState({ progress: currentProgress, message });
      }
    }, 400);
  };

  const handleCapture = () => {
    if (!inputText.trim()) return;

    const raw = inputText.trim();
    const detectedType = detectContentType(raw);

    const firstLine = raw.split("\n")[0].replace(/^[#*-\s]+/, "");
    const generatedTitle = firstLine.slice(0, 40) + (firstLine.length > 40 ? "..." : "");

    const newItem = {
      title: generatedTitle,
      contentType: detectedType,
      summary: raw.slice(0, 120) + (raw.length > 120 ? "..." : ""),
      tags: ["quick-capture", detectedType],
      technologies: [],
      project: "Personal Projects",
      rawContent: raw,
    };

    store.addKnowledgeItem(newItem);
    setRecentSaved((prev) => [newItem, ...prev]);
    setInputText("");
  };

  if (processingState) {
    return (
      <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1 justify-center p-6">
        <ProcessingIndicator
          progress={processingState.progress}
          statusMessage={processingState.message}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-between"
      >
        <ScrollView className="flex-1 px-5 pt-10" showsVerticalScrollIndicator={false}>
          {/* Centered Hero Section */}
          <View className="items-center mt-8 mb-10">
            <Logo size="lg" showText={false} className="mb-4" />
            <Text style={{ color: themeColors.text.primary }} className="text-3xl font-black text-center mb-2 tracking-tight">
              Where should we begin?
            </Text>
            <Text style={{ color: themeColors.text.secondary }} className="text-sm text-center max-w-[300px] leading-relaxed">
              Capture any text, code snippet, link, or document instantly into your AI library.
            </Text>
          </View>

          {/* Quick Action Badges */}
          <View className="flex-row justify-center gap-2 mb-10">
            <TouchableOpacity
              onPress={handlePdfUpload}
              style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }}
              className="flex-row items-center border px-3.5 py-2 rounded-full"
            >
              <Ionicons name="document-text-outline" size={16} color={themeColors.primary} className="mr-2" />
              <Text style={{ color: themeColors.text.secondary }} className="text-xs font-semibold">Upload PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleImageUpload}
              style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }}
              className="flex-row items-center border px-3.5 py-2 rounded-full"
            >
              <Ionicons name="image-outline" size={16} color={themeColors.primary} className="mr-2" />
              <Text style={{ color: themeColors.text.secondary }} className="text-xs font-semibold">Upload Screenshot</Text>
            </TouchableOpacity>
          </View>

          {/* Recently Captured Feedback List */}
          {recentSaved.length > 0 && (
            <View className="mb-8">
              <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-3 px-1">
                Just Captured
              </Text>
              <View className="gap-2">
                {recentSaved.slice(0, 3).map((item, idx) => (
                  <Card key={idx} className="p-3.5 flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold" numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={{ color: themeColors.text.muted }} className="text-[11px] mt-0.5" numberOfLines={1}>
                        {item.summary}
                      </Text>
                    </View>
                    <Tag text={item.contentType} size="sm" />
                  </Card>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* ChatGPT / Gemini Single Floating Input Bar */}
        <View
          style={{ backgroundColor: themeColors.background, borderTopColor: themeColors.border }}
          className="p-4 border-t"
        >
          <View
            style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }}
            className="flex-row items-center border rounded-3xl p-2.5 px-4 shadow-sm"
          >
            {/* Attachment Button */}
            <TouchableOpacity
              onPress={() => {
                Alert.alert("Upload Source File", "Choose file type to ingest:", [
                  { text: "PDF Document", onPress: handlePdfUpload },
                  { text: "Screenshot / Photo", onPress: handleImageUpload },
                  { text: "Cancel", style: "cancel" },
                ]);
              }}
              style={{ backgroundColor: themeColors.surfaceHover, borderColor: themeColors.border }}
              className="w-10 h-10 rounded-full items-center justify-center mr-2 border"
            >
              <Ionicons name="add" size={24} color={themeColors.primary} />
            </TouchableOpacity>

            {/* Expanding Multi-line Text Area */}
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Capture anything... notes, URLs, code, or logs"
              placeholderTextColor={themeColors.text.muted}
              className="flex-1 text-base max-h-32 px-1"
              multiline
              style={{
                color: themeColors.text.primary,
                paddingTop: Platform.OS === "ios" ? 8 : 4,
                paddingBottom: Platform.OS === "ios" ? 8 : 4,
              }}
            />

            {/* Send / Capture Circular Pill */}
            <TouchableOpacity
              onPress={handleCapture}
              disabled={!inputText.trim()}
              className={`w-10 h-10 rounded-full items-center justify-center ml-2 ${
                inputText.trim() ? "bg-primary" : "opacity-40"
              }`}
              style={{ backgroundColor: inputText.trim() ? themeColors.primary : themeColors.border }}
            >
              <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
