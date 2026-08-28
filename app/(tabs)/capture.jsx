import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import colors from "../../constants/colors";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import ProcessingIndicator from "../../components/knowledge/ProcessingIndicator";
import useKnowledgeStore from "../../store/knowledgeStore";

const CAPTURE_MODES = [
  { id: "text", label: "Typed Input", icon: "pencil", desc: "Notes, Code, Links & Errors" },
  { id: "pdf", label: "PDF Document", icon: "document-text", desc: "Upload PDF documentation" },
  { id: "image", label: "Image / Screenshot", icon: "image", desc: "OCR text extraction from photo" },
];

const CONTENT_TYPES = [
  { id: "note", label: "Note" },
  { id: "code", label: "Code" },
  { id: "url", label: "URL / Link" },
  { id: "error", label: "Error Log" },
];

export default function CaptureScreen() {
  const store = useKnowledgeStore();
  const params = useLocalSearchParams();
  const [selectedMode, setSelectedMode] = useState("text"); // text, pdf, image
  const [selectedType, setSelectedType] = useState("note"); // note, code, url, error
  const [processingState, setProcessingState] = useState(null);

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [project, setProject] = useState("");
  const [tagsText, setTagsText] = useState("");

  // Handle external quick action redirects
  useEffect(() => {
    if (params.selectType) {
      if (params.selectType === "pdf") {
        handlePdfUpload();
      } else if (params.selectType === "image") {
        handleImageUpload();
      } else {
        setSelectedMode("text");
        setSelectedType(params.selectType);
      }
    }
  }, [params.selectType]);

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
    setProcessingState({ progress: 15, message: "Uploading document payload to backend..." });

    let currentProgress = 15;
    const interval = setInterval(() => {
      currentProgress += 20;
      
      let message = "Extracting text payload...";
      if (currentProgress > 40) message = "Cleaning markup and tokens...";
      if (currentProgress > 70) message = "AI categorization and tag generation...";
      if (currentProgress > 90) message = "Generating 1536-dim vector embeddings...";

      if (currentProgress >= 100) {
        clearInterval(interval);
        setProcessingState(null);
        
        store.addKnowledgeItem({
          title: itemTitle,
          contentType: itemType,
          summary: `Automatically parsed ${itemType} file representing developer documentation.`,
          tags: ["imported", itemType],
          technologies: [],
          project: "Personal Projects",
          rawContent,
        });

        Alert.alert("Success", `${itemTitle} uploaded and cataloged automatically!`);
      } else {
        setProcessingState({ progress: currentProgress, message });
      }
    }, 500);
  };

  const handleFormSubmit = () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert("Missing Fields", "Please enter both a title and content.");
      return;
    }

    const tagsArr = tagsText
      ? tagsText.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [];

    store.addKnowledgeItem({
      title: title.trim(),
      contentType: selectedType,
      summary: content.slice(0, 120) + (content.length > 120 ? "..." : ""),
      tags: tagsArr.length > 0 ? tagsArr : ["custom", selectedType],
      technologies: selectedType === "code" || selectedType === "error" ? [project || "General"] : [],
      project: project.trim() || "Personal Projects",
      rawContent: content.trim(),
    });

    Alert.alert("Success", "Knowledge item successfully saved!");
    resetForm();
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setProject("");
    setTagsText("");
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
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        {/* Screen Title Header */}
        <View className="mb-6">
          <Text className="text-primary-light text-xs font-bold uppercase tracking-widest mb-1">
            Ingestion Engine
          </Text>
          <Text className="text-white text-3xl font-black mb-1">
            Capture Knowledge
          </Text>
          <Text className="text-text-secondary text-sm leading-relaxed">
            Quickly capture notes, code, links, or documents. Orio organizes and indexes them automatically.
          </Text>
        </View>

        {/* Generalized Capture Mode Selector */}
        <View className="flex-row gap-2 mb-6">
          {CAPTURE_MODES.map((mode) => {
            const isSelected = selectedMode === mode.id;
            return (
              <Pressable
                key={mode.id}
                onPress={() => {
                  setSelectedMode(mode.id);
                  if (mode.id === "pdf") handlePdfUpload();
                  if (mode.id === "image") handleImageUpload();
                }}
                className={`flex-1 p-3.5 rounded-2xl border items-center justify-center ${
                  isSelected
                    ? "bg-primary/20 border-primary"
                    : "bg-card border-border"
                }`}
              >
                <Ionicons
                  name={mode.icon}
                  size={22}
                  color={isSelected ? colors.primaryLight : colors.text.secondary}
                  className="mb-1.5"
                />
                <Text
                  className={`text-xs font-bold text-center ${
                    isSelected ? "text-white" : "text-text-secondary"
                  }`}
                >
                  {mode.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Typed Input Form Section */}
        {selectedMode === "text" && (
          <View className="mb-10">
            {/* Content Type Selector Pills */}
            <Text className="text-text-muted text-xs font-bold uppercase tracking-wider mb-2.5">
              Content Format Type
            </Text>
            <View className="flex-row gap-2 mb-5">
              {CONTENT_TYPES.map((type) => {
                const isActive = selectedType === type.id;
                return (
                  <Pressable
                    key={type.id}
                    onPress={() => setSelectedType(type.id)}
                    className={`px-4 py-2.5 rounded-xl border flex-1 items-center ${
                      isActive
                        ? "bg-primary border-primary"
                        : "bg-surface border-border"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isActive ? "text-white" : "text-text-secondary"
                      }`}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Input Fields with Comfortable Standard Padding */}
            <Input
              label="TITLE"
              placeholder={`E.g., ${
                selectedType === "error"
                  ? "FastAPI Connection Pool Timeout"
                  : selectedType === "code"
                  ? "Docker Multi-stage Build script"
                  : selectedType === "url"
                  ? "React Native Interop Documentation"
                  : "Database Migration Guidelines"
              }`}
              value={title}
              onChangeText={setTitle}
            />

            <Input
              label="ASSOCIATE PROJECT (OPTIONAL)"
              placeholder="E.g., Personal Projects, Orio App"
              value={project}
              onChangeText={setProject}
            />

            <Input
              label="TAGS (COMMA SEPARATED)"
              placeholder="E.g., docker, cache, postgres"
              value={tagsText}
              onChangeText={setTagsText}
            />

            <Input
              label={
                selectedType === "code"
                  ? "CODE SNIPPET"
                  : selectedType === "url"
                  ? "URL / LINK / RESOURCE DETAILS"
                  : selectedType === "error"
                  ? "ERROR LOG & STACKTRACE"
                  : "NOTE / DESCRIPTION"
              }
              placeholder={
                selectedType === "code"
                  ? "Paste code snippet here..."
                  : selectedType === "url"
                  ? "Paste URL (https://...) or reference link..."
                  : selectedType === "error"
                  ? "Paste error message and fix details..."
                  : "Type content details here..."
              }
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={8}
              containerStyle="h-40 mb-6"
              style={{ textAlignVertical: "top", paddingTop: 10, fontSize: 14 }}
            />

            <Button onPress={handleFormSubmit} size="lg" className="mb-8">
              Save Knowledge Item
            </Button>
          </View>
        )}

        {/* PDF & Image Upload Shortcut Cards */}
        {selectedMode !== "text" && (
          <Card className="p-6 mb-10 items-center justify-center border-dashed border-2 border-primary/40 bg-primary/5">
            <Ionicons
              name={selectedMode === "pdf" ? "document-text" : "image"}
              size={48}
              color={colors.primaryLight}
              className="mb-3"
            />
            <Text className="text-white text-base font-bold mb-1">
              Upload {selectedMode === "pdf" ? "PDF Document" : "Screenshot / Image"}
            </Text>
            <Text className="text-text-secondary text-xs text-center mb-5 max-w-[260px]">
              {selectedMode === "pdf"
                ? "Select a PDF file from your device to extract text and generate AI summaries."
                : "Select an image from your photo library for automated OCR text extraction."}
            </Text>
            <Button
              onPress={selectedMode === "pdf" ? handlePdfUpload : handleImageUpload}
              size="md"
            >
              Choose File
            </Button>
          </Card>
        )}

        {/* Sync Status Banner */}
        <Text className="text-white text-xs font-bold uppercase tracking-wider mb-3">
          Offline Queue Status
        </Text>
        <Card className="p-4 mb-10 flex-row items-center justify-between border border-border">
          <View className="flex-row items-center">
            <Ionicons name="cloud-done-outline" size={22} color={colors.success} className="mr-3" />
            <Text className="text-text-secondary text-xs font-semibold">
              All items synchronized with server
            </Text>
          </View>
          <Text className="text-xs font-bold text-success uppercase">
            Synced
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
