// Reused from Premium-website @ 080ea485; original fields and editing logic retained.
// ERP-local presentation, capability controls, scoped API, and isolated previews; no website providers/CSS.
import { useEffect, useState } from "react";
import {CmsEditorFrame as AdminLayout} from "@/cms/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {useCmsClient,useCmsEditor,Button,CmsHtmlPreview} from "@/cms/context";
import {useAuth} from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Languages, Save, Globe, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Translation {
  id: string;
  translation_key: string;
  english_text: string;
  arabic_text: string;
  category: string;
}

const AdminLanguage = () => {
  const api=useCmsClient(); const {confirmDelete}=useCmsEditor(); const {can:canPermission}=useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [siteLanguage, setSiteLanguage] = useState("en");
  const { toast } = useToast();

  const [newTranslation, setNewTranslation] = useState({
    translation_key: "",
    english_text: "",
    arabic_text: "",
    category: "general",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Load site language setting
    const { data: langData } = await api
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", "site_language")
      .single();

    if (langData) {
      setSiteLanguage(langData.setting_value);
    }

    // Load translations
    const { data: transData, error } = await api
      .from("translations")
      .select("*")
      .order("category", { ascending: true })
      .order("translation_key", { ascending: true });

    if (error) {
      toast({
        title: "Error loading translations",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setTranslations(transData || []);
    }
    setLoading(false);
  };

  const handleSaveLanguage = async () => {
    setSaving(true);

    const { error } = await api
      .from("site_settings")
      .update({ setting_value: siteLanguage })
      .eq("setting_key", "site_language");

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Language setting saved. Refresh the page to see changes.",
      });
    }
    setSaving(false);
  };

  const handleUpdateTranslation = async (id: string, field: string, value: string) => {
    // Preserve current typing while serialized saves are in flight.
    setTranslations(current => current.map(t => t.id === id ? { ...t, [field]: value } : t));
    const { error } = await api
      .from("translations")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddTranslation = async () => {
    if (!newTranslation.translation_key || !newTranslation.english_text || !newTranslation.arabic_text) {
      toast({
        title: "Missing fields",
        description: "Please fill all fields",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await api
      .from("translations")
      .insert([newTranslation])
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Translation added successfully",
      });
      setTranslations([...translations, data]);
      setNewTranslation({
        translation_key: "",
        english_text: "",
        arabic_text: "",
        category: "general",
      });
    }
  };

  const handleDeleteTranslation = async (id: string) => {
    if (!await confirmDelete("Are you sure you want to delete this translation?")) return;

    const { error } = await api
      .from("translations")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Translation deleted",
      });
      setTranslations(translations.filter((t) => t.id !== id));
    }
  };

  const getTranslationsByCategory = (category: string) => {
    return translations.filter((t) => t.category === category);
  };

  const categories = Array.from(new Set(translations.map((t) => t.category)));

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-crm-primary-text">Language & Translations</h2>
          <p className="text-muted-foreground mt-2">
            Manage website language and Arabic/English translations
          </p>
        </div>

        {/* Language Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Website Language
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Language</Label>
              <Select value={siteLanguage} onValueChange={setSiteLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية (Arabic)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                This sets the default language for the entire website
              </p>
            </div>
            <Button onClick={handleSaveLanguage} disabled={saving} cmsAction="write">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Language Setting"}
            </Button>
          </CardContent>
        </Card>

        {/* Add New Translation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Translation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Translation Key</Label>
                <Input
                  value={newTranslation.translation_key}
                  onChange={(e) =>
                    setNewTranslation({ ...newTranslation, translation_key: e.target.value })
                  }
                  placeholder="e.g., hero_title"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newTranslation.category}
                  onValueChange={(value) =>
                    setNewTranslation({ ...newTranslation, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="navigation">Navigation</SelectItem>
                    <SelectItem value="hero">Hero</SelectItem>
                    <SelectItem value="common">Common</SelectItem>
                    <SelectItem value="footer">Footer</SelectItem>
                    <SelectItem value="about">About</SelectItem>
                    <SelectItem value="exhibitors">Exhibitors</SelectItem>
                    <SelectItem value="sponsors">Sponsors</SelectItem>
                    <SelectItem value="visitors">Visitors</SelectItem>
                    <SelectItem value="contact">Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>English Text</Label>
                <Textarea
                  value={newTranslation.english_text}
                  onChange={(e) =>
                    setNewTranslation({ ...newTranslation, english_text: e.target.value })
                  }
                  placeholder="Enter English text"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Arabic Text (النص العربي)</Label>
                <Textarea
                  value={newTranslation.arabic_text}
                  onChange={(e) =>
                    setNewTranslation({ ...newTranslation, arabic_text: e.target.value })
                  }
                  placeholder="أدخل النص العربي"
                  rows={3}
                  dir="rtl"
                  className="text-right"
                />
              </div>
            </div>
            <Button onClick={handleAddTranslation} cmsAction="create">
              <Plus className="h-4 w-4 mr-2" />
              Add Translation
            </Button>
          </CardContent>
        </Card>

        {/* Translations by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Manage Translations ({translations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={categories[0] || "general"}>
              <TabsList className="flex-wrap h-auto">
                {categories.map((category) => (
                  <TabsTrigger key={category} value={category} className="capitalize">
                    {category} ({getTranslationsByCategory(category).length})
                  </TabsTrigger>
                ))}
              </TabsList>

              {categories.map((category) => (
                <TabsContent key={category} value={category} className="space-y-4 mt-6">
                  {getTranslationsByCategory(category).map((translation) => (
                    <Card key={translation.id} className="border-2">
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {translation.translation_key}
                            </code>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteTranslation(translation.id)} cmsAction="delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>English</Label>
                              <Textarea
                                value={translation.english_text}
                                onChange={(e) =>
                                  handleUpdateTranslation(
                                    translation.id,
                                    "english_text",
                                    e.target.value
                                  )
                                }
                                rows={3}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>العربية (Arabic)</Label>
                              <Textarea
                                value={translation.arabic_text}
                                onChange={(e) =>
                                  handleUpdateTranslation(
                                    translation.id,
                                    "arabic_text",
                                    e.target.value
                                  )
                                }
                                rows={3}
                                dir="rtl"
                                className="text-right"
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminLanguage;
