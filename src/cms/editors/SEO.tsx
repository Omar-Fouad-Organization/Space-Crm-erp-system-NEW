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
import {useCmsPreview as useSEO} from "@/cms/context";
import { Save, Search, Share2 } from "lucide-react";

interface SEOSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string;
}

const AdminSEO = () => {
  const api=useCmsClient(); const {confirmDelete}=useCmsEditor(); const {can:canPermission}=useAuth();
  const [seoSettings, setSeoSettings] = useState<SEOSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { refreshSEOData } = useSEO();

  useEffect(() => {
    loadSEOSettings();
  }, []);

  const loadSEOSettings = async () => {
    const { data, error } = await api
      .from("site_settings")
      .select("*")
      .eq("category", "seo")
      .order("setting_key", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load SEO settings",
        variant: "destructive",
      });
    } else {
      setSeoSettings(data || []);
    }
    setLoading(false);
  };

  const handleChange = (key: string, value: string) => {
    setSeoSettings(
      seoSettings.map((s) => (s.setting_key === key ? { ...s, setting_value: value } : s))
    );
  };

  const handleSave = async () => {
    setSaving(true);

    for (const setting of seoSettings) {
      const { error } = await api
        .from("site_settings")
        .update({
          setting_value: setting.setting_value,
          updated_at: new Date().toISOString(),
        })
        .eq("id", setting.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update SEO settings",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
    }

    toast({
      title: "Success",
      description: "SEO settings updated successfully",
    });

    // Refresh SEO context to apply changes immediately
    refreshSEOData();

    setSaving(false);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  const metaSettings = seoSettings.filter((s) => s.setting_key.startsWith("meta_"));
  const ogSettings = seoSettings.filter((s) => s.setting_key.startsWith("og_"));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-crm-primary-text">SEO Settings</h2>
            <p className="text-muted-foreground mt-2">
              Optimize your website for search engines and social media
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} cmsAction="write">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Meta Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Meta Tags (SEO)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {metaSettings.map((setting) => (
                <div key={setting.id} className="space-y-2">
                  <Label htmlFor={setting.setting_key}>
                    {setting.description || setting.setting_key}
                  </Label>
                  {setting.setting_key === "meta_description" ||
                  setting.setting_key === "meta_keywords" ? (
                    <Textarea
                      id={setting.setting_key}
                      value={setting.setting_value}
                      onChange={(e) => handleChange(setting.setting_key, e.target.value)}
                      rows={3}
                      placeholder={
                        setting.setting_key === "meta_description"
                          ? "Brief description of your website (150-160 characters)"
                          : "Comma-separated keywords"
                      }
                    />
                  ) : (
                    <Input
                      id={setting.setting_key}
                      value={setting.setting_value}
                      onChange={(e) => handleChange(setting.setting_key, e.target.value)}
                      placeholder="Enter meta title (50-60 characters)"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {setting.setting_key === "meta_title" &&
                      `${setting.setting_value.length}/60 characters`}
                    {setting.setting_key === "meta_description" &&
                      `${setting.setting_value.length}/160 characters`}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Open Graph Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Open Graph (Social Media)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ogSettings.map((setting) => (
                <div key={setting.id} className="space-y-2">
                  <Label htmlFor={setting.setting_key}>
                    {setting.description || setting.setting_key}
                  </Label>
                  {setting.setting_key === "og_description" ? (
                    <Textarea
                      id={setting.setting_key}
                      value={setting.setting_value}
                      onChange={(e) => handleChange(setting.setting_key, e.target.value)}
                      rows={3}
                      placeholder="Description for social media shares"
                    />
                  ) : (
                    <Input
                      id={setting.setting_key}
                      value={setting.setting_value}
                      onChange={(e) => handleChange(setting.setting_key, e.target.value)}
                      placeholder={
                        setting.setting_key === "og_image"
                          ? "Image URL for social media"
                          : "Title for social media"
                      }
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* SEO Tips */}
        <Card>
          <CardHeader>
            <CardTitle>💡 SEO Best Practices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-semibold">Meta Title:</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Keep it under 60 characters</li>
                  <li>Include your main keyword</li>
                  <li>Make it compelling and unique</li>
                  <li>Include your brand name</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Meta Description:</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Keep it between 150-160 characters</li>
                  <li>Include a call-to-action</li>
                  <li>Summarize page content accurately</li>
                  <li>Use active voice</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Keywords:</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Use 5-10 relevant keywords</li>
                  <li>Separate with commas</li>
                  <li>Focus on long-tail keywords</li>
                  <li>Match user search intent</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Open Graph:</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Use high-quality images (1200x630px)</li>
                  <li>Keep titles concise</li>
                  <li>Write engaging descriptions</li>
                  <li>Test with social media preview tools</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSEO;
