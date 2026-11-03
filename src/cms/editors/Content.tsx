// Reused from Premium-website @ 080ea485; original fields and editing logic retained.
// ERP-local presentation, capability controls, scoped API, and isolated previews; no website providers/CSS.
import { useEffect, useState } from "react";
import {CmsEditorFrame as AdminLayout} from "@/cms/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {useCmsClient,useCmsEditor,Button,CmsHtmlPreview} from "@/cms/context";
import {useAuth} from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Save, FileText, Languages } from "lucide-react";

interface PageContent {
  id: string;
  page_name: string;
  section_name: string;
  content_key: string;
  content_value: string;
  content_value_ar: string;
  content_type: string;
  display_order: number;
}

const AdminContent = () => {
  const api=useCmsClient(); const {confirmDelete}=useCmsEditor(); const {can:canPermission}=useAuth();
  const [content, setContent] = useState<PageContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    const { data, error } = await api
      .from("page_content")
      .select("*")
      .order("page_name", { ascending: true })
      .order("section_name", { ascending: true })
      .order("display_order", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load page content",
        variant: "destructive",
      });
    } else {
      setContent(data || []);
    }
    setLoading(false);
  };

  const handleChange = (id: string, field: 'content_value' | 'content_value_ar', value: string) => {
    setContent(
      content.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);

    for (const item of content) {
      const { error } = await api
        .from("page_content")
        .update({
          content_value: item.content_value,
          content_value_ar: item.content_value_ar,
        })
        .eq("id", item.id);

      if (error) {
        toast({
          title: "Error",
          description: `Failed to save ${item.content_key}`,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
    }

    toast({
      title: "Success",
      description: "All content saved successfully",
    });
    setSaving(false);
  };

  const getContentByPage = (pageName: string) => {
    return content.filter((item) => item.page_name === pageName);
  };

  const pages = [
    { name: "home", label: "Homepage" },
    { name: "about", label: "About" },
    { name: "exhibitors", label: "Exhibitors" },
    { name: "sponsors", label: "Sponsors" },
    { name: "sectors", label: "Sectors" },
    { name: "content", label: "Content & Talks" },
    { name: "visitors", label: "Visitors" },
    { name: "contact", label: "Contact" },
  ];

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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-crm-primary-text">Page Content (Bilingual)</h2>
            <p className="text-muted-foreground mt-2">
              Manage all website content in English and Arabic
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} size="lg" cmsAction="write">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save All Changes"}
          </Button>
        </div>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Languages className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Bilingual Content Management</p>
                <p>Edit content in both English and Arabic. Changes will appear on the website when users switch languages.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="home" className="space-y-6">
          <TabsList className="flex-wrap h-auto">
            {pages.map((page) => (
              <TabsTrigger key={page.name} value={page.name}>
                {page.label} ({getContentByPage(page.name).length})
              </TabsTrigger>
            ))}
          </TabsList>

          {pages.map((page) => (
            <TabsContent key={page.name} value={page.name} className="space-y-4">
              {getContentByPage(page.name).length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No content found for this page</p>
                  </CardContent>
                </Card>
              ) : (
                getContentByPage(page.name).map((item) => (
                  <Card key={item.id} className="border-2">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center justify-between">
                        <div>
                          <code className="text-sm bg-muted px-2 py-1 rounded mr-2">
                            {item.content_key}
                          </code>
                          <span className="text-sm text-muted-foreground">
                            {item.section_name}
                          </span>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* English Content */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">EN</span>
                            English
                          </Label>
                          {item.content_type === "textarea" ? (
                            <Textarea
                              aria-label={`${item.page_name}.${item.section_name}.${item.content_key} English`}
                              value={item.content_value}
                              onChange={(e) =>
                                handleChange(item.id, "content_value", e.target.value)
                              }
                              rows={4}
                              className="font-sans"
                            />
                          ) : (
                            <Input
                              aria-label={`${item.page_name}.${item.section_name}.${item.content_key} English`}
                              value={item.content_value}
                              onChange={(e) =>
                                handleChange(item.id, "content_value", e.target.value)
                              }
                              className="font-sans"
                            />
                          )}
                        </div>

                        {/* Arabic Content */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">AR</span>
                            العربية (Arabic)
                          </Label>
                          {item.content_type === "textarea" ? (
                            <Textarea
                              aria-label={`${item.page_name}.${item.section_name}.${item.content_key} Arabic`}
                              value={item.content_value_ar || ""}
                              onChange={(e) =>
                                handleChange(item.id, "content_value_ar", e.target.value)
                              }
                              rows={4}
                              dir="rtl"
                              className="text-right font-sans"
                            />
                          ) : (
                            <Input
                              aria-label={`${item.page_name}.${item.section_name}.${item.content_key} Arabic`}
                              value={item.content_value_ar || ""}
                              onChange={(e) =>
                                handleChange(item.id, "content_value_ar", e.target.value)
                              }
                              dir="rtl"
                              className="text-right font-sans"
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg" cmsAction="write">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save All Changes"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminContent;
