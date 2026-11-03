// Reused from Premium-website @ 080ea485; original fields and editing logic retained.
// ERP-local presentation, capability controls, scoped API, and isolated previews; no website providers/CSS.
import { useEffect, useState } from "react";
import {CmsEditorFrame as AdminLayout} from "@/cms/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import {useCmsClient,useCmsEditor,Button,CmsHtmlPreview} from "@/cms/context";
import {useAuth} from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Upload, Image as ImageIcon, Check } from "lucide-react";

const AdminLogo = () => {
  const api=useCmsClient(); const {confirmDelete}=useCmsEditor(); const {can:canPermission}=useAuth();
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadLogos();
  }, []);

  const loadLogos = async () => {
    const { data } = await api
      .from("site_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["logo_url", "favicon_url"]);

    if (data) {
      setLogoUrl(data.find((item) => item.setting_key === "logo_url")?.setting_value || "");
      setFaviconUrl(data.find((item) => item.setting_key === "favicon_url")?.setting_value || "");
    }
    setLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg","image/png","image/webp","image/gif","image/x-icon","image/vnd.microsoft.icon"].includes(file.type)) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingLogo(true);

    try {
      // Upload to Laravel storage
      const fileExt = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await api.storage
        .from("premium_logos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = api.storage
        .from("premium_logos")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await api.from("site_settings").upsert({
        setting_key: "logo_url", setting_value: publicUrl, category: "branding", setting_type: "image",
      }, { onConflict: "setting_key" });

      if (updateError) {
        console.error("Update error:", updateError);
        throw updateError;
      }

      setLogoUrl(publicUrl);
      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg","image/png","image/webp","image/gif","image/x-icon","image/vnd.microsoft.icon"].includes(file.type)) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 1MB for favicon)
    if (file.size > 1 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Favicon size must be less than 1MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingFavicon(true);

    try {
      // Upload to Laravel storage
      const fileExt = file.name.split(".").pop();
      const fileName = `favicon-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await api.storage
        .from("premium_logos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = api.storage
        .from("premium_logos")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await api.from("site_settings").upsert({
        setting_key: "favicon_url", setting_value: publicUrl, category: "branding", setting_type: "image",
      }, { onConflict: "setting_key" });

      if (updateError) {
        console.error("Update error:", updateError);
        throw updateError;
      }

      setFaviconUrl(publicUrl);

      // Update favicon in document

      toast({
        title: "Success",
        description: "Favicon uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload favicon",
        variant: "destructive",
      });
    } finally {
      setUploadingFavicon(false);
    }
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-crm-primary-text">Logo & Branding</h2>
          <p className="text-muted-foreground mt-2">
            Upload and manage your website logo and favicon
          </p>
        </div>

        {/* Main Logo Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Main Logo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label>Upload Logo</Label>
              <p className="text-sm text-muted-foreground">
                Upload your logo image (PNG, JPG, GIF, ICO, or WebP). Recommended size: 400x100px. Max file size: 5MB.
              </p>

              <div className="flex items-center gap-4">
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden" disabled={!canPermission('media.upload')}
                />
                <Button
                  onClick={() => document.getElementById("logo-upload")?.click()}
                  disabled={uploadingLogo} cmsAction="upload"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingLogo ? "Uploading..." : "Upload Logo"}
                </Button>
                {logoUrl && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Check className="h-4 w-4" />
                    Logo uploaded
                  </div>
                )}
              </div>

              {/* Logo Preview */}
              {logoUrl && (
                <div className="space-y-2">
                  <Label>Current Logo Preview</Label>
                  <div className="p-6 bg-muted rounded-lg">
                    <img
                      src={logoUrl}
                      alt="Logo Preview"
                      className="h-16 w-auto"
                    />
                  </div>
                  <div className="p-6 bg-gray-900 rounded-lg">
                    <img
                      src={logoUrl}
                      alt="Logo Preview on Dark"
                      className="h-16 w-auto brightness-0 invert"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Favicon Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Favicon
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label>Upload Favicon</Label>
              <p className="text-sm text-muted-foreground">
                Upload your favicon (the small icon that appears in browser tabs). Recommended size: 32x32px or 64x64px. Max file size: 1MB.
              </p>

              <div className="flex items-center gap-4">
                <input
                  type="file"
                  id="favicon-upload"
                  accept="image/*"
                  onChange={handleFaviconUpload}
                  className="hidden" disabled={!canPermission('media.upload')}
                />
                <Button
                  onClick={() => document.getElementById("favicon-upload")?.click()}
                  disabled={uploadingFavicon} cmsAction="upload"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingFavicon ? "Uploading..." : "Upload Favicon"}
                </Button>
                {faviconUrl && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Check className="h-4 w-4" />
                    Favicon uploaded
                  </div>
                )}
              </div>

              {/* Favicon Preview */}
              {faviconUrl && (
                <div className="space-y-2">
                  <Label>Current Favicon Preview</Label>
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <img
                        src={faviconUrl}
                        alt="Favicon Preview"
                        className="h-8 w-8"
                      />
                    </div>
                    <div className="p-4 bg-gray-900 rounded-lg">
                      <img
                        src={faviconUrl}
                        alt="Favicon Preview on Dark"
                        className="h-8 w-8"
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>Preview at actual size (32x32px)</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Guidelines */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-3 text-blue-900">Logo Usage Guidelines</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• Logo appears in the header (top navigation) and footer of all pages</li>
              <li>• Recommended logo format: PNG with transparent background or WebP</li>
              <li>• Logo should be horizontal/landscape orientation for best results</li>
              <li>• Favicon appears in browser tabs and bookmarks</li>
              <li>• Favicon should be square (1:1 ratio) for best results</li>
              <li>• Changes take effect immediately after upload</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminLogo;
