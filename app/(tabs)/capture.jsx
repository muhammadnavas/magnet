import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, SafeAreaView, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import colors from "../../constants/colors";
import CaptureButton from "../../components/capture/CaptureButton";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import ProcessingIndicator from "../../components/knowledge/ProcessingIndicator";
import useKnowledgeStore from "../../store/knowledgeStore";

export default function CaptureScreen() {
  const store = useKnowledgeStore();
  const params = useLocalSearchParams();
  const [activeForm, setActiveForm] = useState(null); // null, note, code, error, url
  const [processingState, setProcessingState] = useState(null); // null, { progress: 0, message: "" }

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [project, setProject] = useState("");
  const [tagsText, setTagsText] = useState("");

  // Handle external redirect from HomeScreen quick capture
  useEffect(() => {
    if (params.selectType) {
      handleCaptureSelect(params.selectType);
    }
  }, [params.selectType]);

  const handleCaptureSelect = async (type) => {
    if (type === "pdf") {
      try {
        const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
        if (!res.canceled && res.assets && res.assets.length > 0) {
          const asset = res.assets[0];
          triggerIngestionFlow(asset.name, "pdf", `Extracted text content from PDF file: ${asset.name}`);
        }
      } catch (err) {
        console.error("Document Picker Error:", err);
      }
    } else if (type === "image") {
      try {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission Denied", "Library access permissions are required to upload screenshots.");
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    } else {
      setActiveForm(type);
    }
  };

  const triggerIngestionFlow = (itemTitle, itemType, rawContent) => {
    setProcessingState({ progress: 10, message: "Uploading package to backend storage..." });

    let currentProgress = 10;
    const interval = setInterval(() => {
      currentProgress += 15;
      
      let message = "Extracting text payloads...";
      if (currentProgress > 40) message = "Cleaning markup and tokens...";
      if (currentProgress > 70) message = "AI categorization and tag generation...";
      if (currentProgress > 90) message = "Generating document vector embeddings...";

      if (currentProgress >= 100) {
        clearInterval(interval);
        setProcessingState(null);
        
        // Add to global store
        store.addKnowledgeItem({
          title: itemTitle,
          contentType: itemType,
          summary: `Automatically parsed ${itemType} file representing developer documentation tags.`,
          tags: ["imported", itemType],
          technologies: [],
          project: "Personal Projects",
          rawContent,
        });

        Alert.alert("Success", `${itemTitle} uploaded and cataloged automatically!`);
      } else {
        setProcessingState({ progress: currentProgress, message });
      }
    }, 600);
  };

  const handleFormSubmit = () => {
    if (!title || !content) {
      Alert.alert("Missing Fields", "Title and content are required.");
      return;
    }

    const tagsArr = tagsText
      ? tagsText.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [];

    store.addKnowledgeItem({
      title,
      contentType: activeForm,
      summary: content.slice(0, 100) + (content.length > 100 ? "..." : ""),
      tags: tagsArr.length > 0 ? tagsArr : ["custom", activeForm],
      technologies: activeForm === "code" || activeForm === "error" ? [project || "General"] : [],
      project: project || "Personal Projects",
      rawContent: content,
    });

    Alert.alert("Success", "Knowledge item successfully saved!");
    resetForm();
  };

  const resetForm = () => {
    setActiveForm(null);
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

  if (activeForm) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-white text-lg font-black uppercase">
              New {activeForm}
            </Text>
            <Button variant="ghost" size="sm" onPress={resetForm}>
              Cancel
            </Button>
          </View>

          {/* Form fields */}
          <Input
            label="TITLE"
            placeholder={`E.g., ${
              activeForm === "error"
                ? "FastAPI Connection Pool Timeout"
                : activeForm === "code"
                ? "Docker multi-stage builder"
                : "Docker network rules"
            }`}
            value={title}
            onChangeText={setTitle}
          />

          <Input
            label="ASSOCIATE PROJECT (OPTIONAL)"
            placeholder="E.g., Email Scheduler"
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
            label="CONTENT / BODY"
            placeholder={
              activeForm === "code"
                ? "Paste code snippet here..."
                : activeForm === "error"
                ? "Paste error message and solution details here..."
                : "Type details of note here..."
            }
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={8}
            containerStyle="h-32 mb-10"
            style={{ textAlignVertical: "top", paddingTop: 8 }}
          />

          <Button onPress={handleFormSubmit} className="mb-10 shadow-lg shadow-primary/20">
            Save Item
          </Button>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        {/* Caption Header */}
        <View className="mb-8">
          <Text className="text-primary-light text-xs font-bold uppercase tracking-widest mb-1.5">
            Ingestion Engine
          </Text>
          <Text className="text-white text-2xl font-black mb-2">
            Capture Knowledge
          </Text>
          <Text className="text-text-secondary text-sm leading-relaxed max-w-[280px]">
            Capture now. Organize automatically. Orio analyzes inputs behind the scenes.
          </Text>
        </View>

        {/* Capture Buttons Grid */}
        <View className="flex-row flex-wrap justify-between mb-8">
          <CaptureButton
            label="Note"
            icon="pencil"
            color="#A0A0B8"
            onPress={() => handleCaptureSelect("note")}
          />
          <CaptureButton
            label="PDF Ingestion"
            icon="document-text"
            color="#6C63FF"
            onPress={() => handleCaptureSelect("pdf")}
          />
          <CaptureButton
            label="Screenshot"
            icon="image"
            color="#00E5A0"
            onPress={() => handleCaptureSelect("image")}
          />
          <CaptureButton
            label="Import URL"
            icon="link"
            color="#FF9F43"
            onPress={() => handleCaptureSelect("url")}
          />
          <CaptureButton
            label="Code Snippet"
            icon="code-working"
            color="#00D4FF"
            onPress={() => handleCaptureSelect("code")}
          />
          <CaptureButton
            label="Voice Note"
            icon="mic"
            color="#6C63FF"
            onPress={() => alert("Voice recording is coming in Phase 2!")}
          />
          <CaptureButton
            label="Error Log"
            icon="bug"
            color="#FF6B6B"
            onPress={() => handleCaptureSelect("error")}
          />
          <View className="flex-1 min-h-[100px] m-1.5 bg-transparent" />
        </View>

        {/* Recent captures card list */}
        <Text className="text-white text-sm font-bold uppercase tracking-wider mb-3">
          Offline Queue Status
        </Text>
        <Card className="p-4 mb-10 flex-row items-center justify-between border-dashed border border-border">
          <View className="flex-row items-center">
            <Ionicons name="cloud-done-outline" size={20} color={colors.success} className="mr-3" />
            <Text className="text-text-secondary text-xs font-semibold">
              All captures synchronized to backend
            </Text>
          </View>
          <Text className="text-[10px] font-bold text-success uppercase">
            Synced
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
