import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Platform, Modal, Image, Linking, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import colors from "../../constants/colors";
import config from "../../constants/config";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import LoadingState from "../../components/ui/LoadingState";
import useKnowledge from "../../hooks/useKnowledge";
import { formatDate } from "../../utils/formatting";
import { useAppTheme } from "../../store/themeStore";
import * as FileSystem from "expo-file-system/legacy";

export default function KnowledgeDetailScreen() {
  const { id } = useLocalSearchParams();
  const { useGetItemDetail, deleteItem } = useKnowledge();
  const { data: item, isLoading, error } = useGetItemDetail(id);
  const { themeColors } = useAppTheme();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSourceViewer, setShowSourceViewer] = useState(false);
  const [sourceToken, setSourceToken] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [pdfBase64, setPdfBase64] = useState("");
  const [imageUri, setImageUri] = useState(null);

  const sourceUrl = `${config.API_URL}/knowledge/${id}/source`;
  const contentType = (item?.contentType || "note").toLowerCase();
  const isImage = contentType === "image";
  const isPdf = contentType === "pdf";
  const isTextSource = ["note", "code", "error"].includes(contentType);
  const isUrl = contentType === "url";

  // Magnet uses personal mode without bearer-token authentication. Source files
  // are fetched from the same API session as the rest of the knowledge library.
  useEffect(() => {
    if (!showSourceViewer) {
      setSourceToken(null);
      return;
    }
    setSourceError("");
    setSourceToken("personal-mode");
  }, [showSourceViewer]);

  // Download protected images with the same authenticated flow used for PDFs.
  // React Native's remote Image loader can otherwise remain blank on failed
  // bearer-authenticated requests without surfacing the HTTP status.
  useEffect(() => {
    if (!showSourceViewer || !isImage || !sourceToken) return;
    let cancelled = false;
    const loadImage = async () => {
      setSourceLoading(true);
      setSourceError("");
      setImageUri(null);
      const extension = /\\.(png|webp|gif|jpeg|jpg)$/i.exec(title || "")?.[1] || "jpg";
      const destination = `${FileSystem.cacheDirectory}orio-source-${id}.${extension}`;
      try {
        const downloadPromise = FileSystem.downloadAsync(sourceUrl, destination, {
          
        });
        const result = await Promise.race([
          downloadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("The image server took too long to respond. Check your connection and try again.")), 25000)),
        ]);
        if (result.status < 200 || result.status >= 300) {
          throw new Error(result.status === 404
            ? "The original image is missing from storage. Upload it again."
            : `The server could not load this image (HTTP ${result.status}).`);
        }
        const info = await FileSystem.getInfoAsync(result.uri);
        if (!info.exists || !info.size) throw new Error("The server returned an empty image file.");
        if (!cancelled) setImageUri(result.uri);
      } catch (error) {
        console.error("Image download failed:", error);
        if (!cancelled) setSourceError(error?.message || "Could not download the original image.");
      } finally {
        if (!cancelled) setSourceLoading(false);
      }
    };
    loadImage();
    return () => { cancelled = true; };
  }, [showSourceViewer, isImage, sourceToken, sourceUrl, id, title]);

  // Android WebView does not render PDF files natively. Download the protected
  // source with the user's bearer token and render its bytes with PDF.js.
  useEffect(() => {
    if (!showSourceViewer || !isPdf || !sourceToken) return;
    let cancelled = false;
    const loadPdf = async () => {
      setSourceLoading(true);
      setSourceError("");
      setPdfBase64("");
      let localUri;
      try {
        const downloadPromise = FileSystem.downloadAsync(sourceUrl, `${FileSystem.cacheDirectory}orio-source-${id}.pdf`, {
          
        });
        // Avoid leaving the preview spinner running forever when the API or
        // storage provider does not complete the protected file request.
        const result = await Promise.race([
          downloadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("The PDF server took too long to respond. Check your connection and try again.")), 25000)),
        ]);
        if (result.status < 200 || result.status >= 300) {
          throw new Error(result.status === 404
            ? "The original PDF is missing from storage. Upload the document again."
            : `The server could not load this PDF (HTTP ${result.status}).`);
        }
        localUri = result.uri;
        const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
        if (!base64 || !base64.startsWith("JVBER")) {
          throw new Error("The server response is not a valid PDF. Check the backend source endpoint.");
        }
        if (!cancelled) setPdfBase64(base64);
      } catch (error) {
        console.error("PDF download/render preparation failed:", error);
        if (!cancelled) setSourceError(error?.message || "Could not download the original PDF.");
      } finally {
        if (!cancelled) setSourceLoading(false);
      }
    };
    loadPdf();
    return () => { cancelled = true; };
  }, [showSourceViewer, isPdf, sourceToken, sourceUrl, id]);

  if (isLoading) {
    return <LoadingState message="Fetching item details..." fullScreen />;
  }

  if (error || !item) {
    return (
      <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1 justify-center p-6" edges={["top", "left", "right"]}>
        <Text style={{ color: themeColors.text.primary }} className="text-center text-base font-bold mb-4">
          Error Loading Item
        </Text>
        <Button onPress={() => router.back()}>Go Back</Button>
      </SafeAreaView>
    );
  }

  const { title, summary, project, createdAt, rawContent, keyPoints = [], relatedItems = [] } = item;


  const handleDelete = () => {
    setShowDeleteConfirm(false);
    deleteItem(id);
    router.back();
  };

  const getHeaderIcon = () => {
    switch (contentType) {
      case "pdf": return "document-text";
      case "image": return "image";
      case "code": return "code-working";
      case "error": return "bug";
      case "url": return "link";
      case "note":
      default: return "pencil";
    }
  };

  const getSourceLabel = () => {
    if (isPdf) return "View Document";
    if (isImage) return "View Image";
    if (isTextSource) return "View Original Content";
    if (isUrl) return "Open Source URL";
    return "View Source";
  };

  const openSource = async () => {
    if (isUrl && item.sourceUrl) {
      await Linking.openURL(item.sourceUrl);
      return;
    }
    setShowSourceViewer(true);
  };

  const renderSourceViewer = () => {
    if (isTextSource) {
      return (
        <ScrollView className="flex-1 px-5 py-4" showsVerticalScrollIndicator={false}>
          <Card style={{ backgroundColor: themeColors.surfaceHover }} className="p-4">
            <Text
              selectable
              style={{ color: themeColors.text.secondary, fontFamily: Platform.OS === "ios" ? "CourierNewPSMT" : "monospace" }}
              className="text-xs leading-relaxed"
            >
              {rawContent || "No original content is available."}
            </Text>
          </Card>
        </ScrollView>
      );
    }

    if (isImage) {
      if (sourceLoading) {
        return <View className="flex-1 items-center justify-center"><ActivityIndicator color={themeColors.primary} /><Text style={{ color: themeColors.text.muted }} className="text-xs mt-3">Loading image…</Text></View>;
      }
      if (sourceError || !imageUri) {
        return (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="image-outline" size={42} color={themeColors.text.muted} />
            <Text style={{ color: themeColors.text.primary }} className="text-base font-bold text-center mt-4">Image unavailable</Text>
            <Text style={{ color: themeColors.text.secondary }} className="text-sm text-center mt-2">{sourceError || "The image could not be loaded."}</Text>
            <Pressable
              onPress={() => {
                setSourceError("");
                setImageUri(null);
                setSourceToken(null);
                setShowSourceViewer(false);
                setTimeout(() => setShowSourceViewer(true), 150);
              }}
              style={{ backgroundColor: themeColors.primary }}
              className="mt-5 px-5 py-3 rounded-xl"
            >
              <Text className="text-white font-bold text-sm">Try again</Text>
            </Pressable>
          </View>
        );
      }
      return (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }} maximumZoomScale={4} minimumZoomScale={1} showsVerticalScrollIndicator={false}>
          <Image
            source={{ uri: imageUri }}
            style={{ width: "100%", height: 520, resizeMode: "contain", backgroundColor: themeColors.surfaceHover, borderRadius: 16 }}
            onError={() => setSourceError("The downloaded image could not be displayed.")}
          />
        </ScrollView>
      );
    }

    if (isPdf) {
      if (sourceLoading) {
        return <View className="flex-1 items-center justify-center"><ActivityIndicator color={themeColors.primary} /><Text style={{ color: themeColors.text.muted }} className="text-xs mt-3">Loading PDF…</Text></View>;
      }
      if (sourceError || !sourceToken || !pdfBase64) {
        return (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="document-text-outline" size={42} color={themeColors.text.muted} />
            <Text style={{ color: themeColors.text.primary }} className="text-base font-bold text-center mt-4">PDF unavailable</Text>
            <Text style={{ color: themeColors.text.secondary }} className="text-sm text-center mt-2">{sourceError || "The PDF could not be loaded."}</Text>
            <Pressable
              onPress={() => {
                setSourceError("");
                setPdfBase64("");
                setSourceToken(null);
                setShowSourceViewer(false);
                setTimeout(() => setShowSourceViewer(true), 150);
              }}
              style={{ backgroundColor: themeColors.primary }}
              className="mt-5 px-5 py-3 rounded-xl"
            >
              <Text className="text-white font-bold text-sm">Try again</Text>
            </Pressable>
          </View>
        );
      }
      const viewerHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=3"><style>
        *{box-sizing:border-box}body{margin:0;padding:12px;background:${themeColors.background};color:${themeColors.text.primary};font-family:Arial,sans-serif}
        #status{text-align:center;padding:16px;font-size:13px;color:${themeColors.text.secondary}}canvas{display:block;width:100%;height:auto;margin:0 auto 12px;background:white;box-shadow:0 2px 8px #0003}
      </style></head><body><div id="status">Preparing PDF…</div><div id="pages"></div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script><script>
      (async()=>{const status=document.getElementById('status');try{
        if(!window.pdfjsLib)throw new Error('PDF viewer library could not load. Check your internet connection.');
        pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const binary=atob('${pdfBase64}');const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
        const pdf=await pdfjsLib.getDocument({data:bytes}).promise;status.textContent=pdf.numPages+' page'+(pdf.numPages===1?'':'s');
        const root=document.getElementById('pages');
        for(let pageNum=1;pageNum<=pdf.numPages;pageNum++){const page=await pdf.getPage(pageNum);const base=page.getViewport({scale:1});const scale=Math.min((window.innerWidth-24)/base.width,2);const viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=viewport.width*window.devicePixelRatio;canvas.height=viewport.height*window.devicePixelRatio;canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';root.appendChild(canvas);await page.render({canvasContext:canvas.getContext('2d'),viewport:page.getViewport({scale:scale*window.devicePixelRatio})}).promise;}
      }catch(e){status.textContent='Could not display PDF: '+(e.message||'Unknown error');}})();
      </script></body></html>`;
      return (
        <WebView
          style={{ flex: 1, backgroundColor: themeColors.background }}
          source={{ html: viewerHtml, baseUrl: "https://cdnjs.cloudflare.com" }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => <View className="flex-1 items-center justify-center"><ActivityIndicator color={themeColors.primary} /></View>}
          onError={(event) => {
            const description = event?.nativeEvent?.description;
            console.error("PDF WebView load failed:", description || "unknown error");
            setSourceError(description ? `The PDF viewer failed: ${description}` : "The PDF viewer could not be loaded.");
          }}
        />
      );
    }

    return (
      <View className="flex-1 items-center justify-center px-8">
        <Ionicons name="document-outline" size={44} color={themeColors.text.muted} />
        <Text style={{ color: themeColors.text.primary }} className="text-base font-bold text-center mt-4">Source preview unavailable</Text>
        <Text style={{ color: themeColors.text.secondary }} className="text-xs text-center mt-2">This source type does not have an in-app preview yet.</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1" edges={["top", "left", "right"]}>
      <Modal visible={showSourceViewer} animationType="slide" onRequestClose={() => setShowSourceViewer(false)}>
        <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1" edges={["top", "left", "right", "bottom"]}>
          <View style={{ backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }} className="flex-row items-center px-5 py-3 border-b">
            <Pressable onPress={() => setShowSourceViewer(false)} hitSlop={10} className="p-1 -ml-1">
              <Ionicons name="close" size={24} color={themeColors.text.primary} />
            </Pressable>
            <View className="flex-1 px-3">
              <Text style={{ color: themeColors.text.primary }} className="text-sm font-bold" numberOfLines={1}>{title}</Text>
              <Text style={{ color: themeColors.text.muted }} className="text-[10px] uppercase tracking-wider mt-0.5">Original source</Text>
            </View>
            <Ionicons name={getHeaderIcon()} size={20} color={themeColors.primaryLight} />
          </View>
          {renderSourceViewer()}
          {!!sourceError && (
            <View style={{ backgroundColor: `${themeColors.error || "#EF4444"}18`, borderTopColor: `${themeColors.error || "#EF4444"}30` }} className="px-5 py-3 border-t">
              <Text style={{ color: themeColors.error || "#EF4444" }} className="text-xs font-semibold">{sourceError}</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={{ backgroundColor: "rgba(0,0,0,0.7)" }} className="flex-1 justify-center items-center px-6">
          <View style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }} className="w-full max-w-sm rounded-3xl p-6 border shadow-2xl">
            <View style={{ backgroundColor: `${themeColors.error || "#EF4444"}18` }} className="w-14 h-14 rounded-full items-center justify-center self-center mb-4">
              <Ionicons name="trash-outline" size={28} color={themeColors.error || "#EF4444"} />
            </View>
            <Text style={{ color: themeColors.text.primary }} className="text-xl font-black text-center mb-2">Delete Item?</Text>
            <Text style={{ color: themeColors.text.secondary }} className="text-sm text-center mb-6 leading-relaxed">Are you sure you want to permanently delete this item? This action cannot be undone.</Text>
            <View className="flex-row gap-3">
              <Pressable onPress={() => setShowDeleteConfirm(false)} style={{ backgroundColor: themeColors.surfaceHover, borderColor: themeColors.border }} className="flex-1 py-3.5 rounded-2xl items-center border">
                <Text style={{ color: themeColors.text.primary }} className="font-bold">Cancel</Text>
              </Pressable>
              <Pressable onPress={handleDelete} style={{ backgroundColor: themeColors.error || "#EF4444" }} className="flex-1 py-3.5 rounded-2xl items-center shadow-lg">
                <Text className="font-bold text-white">Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }} className="flex-row items-center justify-between px-5 py-3 border-b">
        <Pressable onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="p-1 -ml-1">
          <Ionicons name="arrow-back" size={22} color={themeColors.text.primary} />
        </Pressable>
        <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold uppercase tracking-wider text-center flex-1 px-2" numberOfLines={1}>{contentType} detail</Text>
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => setShowDeleteConfirm(true)} hitSlop={10} style={{ backgroundColor: `${themeColors.error || '#EF4444'}18` }} className="w-9 h-9 rounded-full items-center justify-center">
            <Ionicons name="trash-outline" size={18} color={themeColors.error || "#EF4444"} />
          </Pressable>

        </View>
      </View>

      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        <View className="mb-5">
          <View className="flex-row items-center mb-2">
            <Ionicons name={getHeaderIcon()} size={16} color={themeColors.primaryLight} className="mr-2" />
            <Text style={{ color: themeColors.text.muted }} className="text-[10px] font-bold uppercase tracking-widest">Created {formatDate(createdAt)}</Text>
          </View>
          <Text style={{ color: themeColors.text.primary }} className="text-xl font-black mb-3 leading-snug">{title}</Text>
          <View className="flex-row flex-wrap gap-1.5 items-center">
            <View style={{ backgroundColor: `${themeColors.primary}18`, borderColor: `${themeColors.primary}30` }} className="border px-3 py-1 rounded-full flex-row items-center">
              <Ionicons name="folder-outline" size={10} color={themeColors.primaryLight} className="mr-1" />
              <Text style={{ color: themeColors.primaryLight }} className="text-[9px] font-bold uppercase tracking-wider">{project}</Text>
            </View>
          </View>
        </View>

        <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold uppercase tracking-widest mb-2.5">AI Summary</Text>
        <Card style={{ backgroundColor: `${themeColors.primary}10`, borderLeftColor: themeColors.primary, borderLeftWidth: 4 }} className="p-4 mb-5">
          <Text style={{ color: themeColors.text.secondary }} className="text-xs leading-relaxed font-medium">{summary}</Text>
        </Card>

        {keyPoints && keyPoints.length > 0 && (
          <View className="mb-5">
            <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold uppercase tracking-widest mb-2.5">Key Insights</Text>
            <Card className="p-4">
              {keyPoints.map((point, index) => (
                <View key={index} className="flex-row items-start mb-2.5">
                  <Ionicons name="checkmark-circle-outline" size={14} color={themeColors.success} className="mr-2.5 mt-0.5" />
                  <Text style={{ color: themeColors.text.secondary }} className="text-xs flex-1 leading-normal font-medium">{point}</Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold uppercase tracking-widest mb-2.5">Source Document</Text>
        <Pressable onPress={openSource} className="mb-5" style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}>
          <Card style={{ backgroundColor: `${themeColors.primary}10`, borderColor: `${themeColors.primary}35` }} className="p-4 border">
            <View className="flex-row items-center">
              <View style={{ backgroundColor: `${themeColors.primary}20` }} className="w-11 h-11 rounded-2xl items-center justify-center mr-3">
                <Ionicons name={isImage ? "image" : isPdf ? "document-text" : isUrl ? "link" : "document"} size={22} color={themeColors.primaryLight} />
              </View>
              <View className="flex-1">
                <Text style={{ color: themeColors.text.primary }} className="text-sm font-bold" numberOfLines={1}>{title}</Text>
                <Text style={{ color: themeColors.text.secondary }} className="text-[11px] mt-1">{getSourceLabel()}</Text>
              </View>
              <View style={{ backgroundColor: themeColors.primary }} className="px-3.5 py-2 rounded-xl flex-row items-center">
                <Text className="text-white text-[11px] font-bold mr-1.5">View</Text>
                <Ionicons name="chevron-forward" size={13} color="#fff" />
              </View>
            </View>
          </Card>
        </Pressable>

        <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold uppercase tracking-widest mb-2.5">Original Payload</Text>
        <Card style={{ backgroundColor: themeColors.surfaceHover }} className="p-4 mb-5">
          <Text selectable style={{ color: themeColors.text.secondary, fontFamily: Platform.OS === "ios" ? "CourierNewPSMT" : "monospace" }} className="text-xs leading-relaxed font-mono">{rawContent || "No raw payload available."}</Text>
        </Card>

        {relatedItems && relatedItems.length > 0 && (
          <View className="mb-10">
            <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold uppercase tracking-widest mb-2.5">Related Connections</Text>
            {relatedItems.map((rel) => (
              <Pressable key={rel.id} onPress={() => router.push(`/knowledge/${rel.id}`)} className="mb-2">
                <Card style={{ borderStyle: "dashed" }} className="p-3 flex-row items-center justify-between border">
                  <View className="flex-row items-center">
                    <Ionicons name="link-outline" size={14} color={themeColors.primaryLight} className="mr-2" />
                    <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold">{rel.title}</Text>
                  </View>
                  <Text style={{ color: themeColors.text.muted }} className="text-[10px] uppercase font-bold">{rel.type}</Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
