import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import colors from "../../constants/colors";
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

  // Smart automatic content type detector
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

    // Auto generate clean title from the first line or content snippet
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
      <SafeAreaView className="flex-1 bg-background justify-center p-6">
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
            <Text className="text-white text-3xl font-black text-center mb-2 tracking-tight">
              Where should we begin?
            </Text>
            <Text className="text-text-secondary text-sm text-center max-w-[300px] leading-relaxed">
              Capture any text, code snippet, link, or document instantly into your AI library.
            </Text>
          </View>

          {/* Quick Action Badges */}
          <View className="flex-row justify-center gap-2 mb-10">
            <TouchableOpacity
              onPress={handlePdfUpload}
              className="flex-row items-center bg-card border border-border px-3.5 py-2 rounded-full"
            >
              <Ionicons name="document-text-outline" size={16} color={colors.primaryLight} className="mr-2" />
              <Text className="text-text-secondary text-xs font-semibold">Upload PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleImageUpload}
              className="flex-row items-center bg-card border border-border px-3.5 py-2 rounded-full"
            >
              <Ionicons name="image-outline" size={16} color={colors.primaryLight} className="mr-2" />
              <Text className="text-text-secondary text-xs font-semibold">Upload Screenshot</Text>
            </TouchableOpacity>
          </View>

          {/* Recently Captured Feedback List */}
          {recentSaved.length > 0 && (
            <View className="mb-8">
              <Text className="text-text-muted text-xs font-bold uppercase tracking-wider mb-3 px-1">
                Just Captured
              </Text>
              <View className="gap-2">
                {recentSaved.slice(0, 3).map((item, idx) => (
                  <Card key={idx} className="p-3.5 flex-row items-center justify-between border border-border/80 bg-card">
                    <View className="flex-1 mr-3">
                      <Text className="text-white text-xs font-bold" numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text className="text-text-muted text-[11px] mt-0.5" numberOfLines={1}>
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
        <View className="p-4 bg-background border-t border-border/30">
          <View className="flex-row items-center bg-card border border-border/90 rounded-3xl p-2.5 px-4 shadow-xl">
            {/* Attachment Button */}
            <TouchableOpacity
              onPress={() => {
                Alert.alert("Upload Source File", "Choose file type to ingest:", [
                  { text: "PDF Document", onPress: handlePdfUpload },
                  { text: "Screenshot / Photo", onPress: handleImageUpload },
                  { text: "Cancel", style: "cancel" },
                ]);
              }}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-2 border border-border/60"
            >
              <Ionicons name="add" size={24} color={colors.primaryLight} />
            </TouchableOpacity>

            {/* Expanding Multi-line Text Area */}
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Capture anything... notes, URLs, code, or logs"
              placeholderTextColor={colors.text.muted}
              className="flex-1 text-white text-base max-h-32 px-1"
              multiline
              style={{ paddingTop: Platform.OS === "ios" ? 8 : 4, paddingBottom: Platform.OS === "ios" ? 8 : 4 }}
            />

            {/* Send / Capture Circular Pill */}
            <TouchableOpacity
              onPress={handleCapture}
              disabled={!inputText.trim()}
              className={`w-10 h-10 rounded-full items-center justify-center ml-2 ${
                inputText.trim() ? "bg-primary" : "bg-surface-hover opacity-40"
              }`}
            >
              <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
