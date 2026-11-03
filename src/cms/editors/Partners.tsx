// Reused from Premium-website @ 080ea485; original fields and editing logic retained.
// ERP-local presentation, capability controls, scoped API, and isolated previews; no website providers/CSS.
import { useState, useEffect } from "react";
import {CmsEditorFrame as AdminLayout} from "@/cms/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {useCmsClient,useCmsEditor,Button,CmsHtmlPreview} from "@/cms/context";
import {useAuth} from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, ExternalLink, Upload, Users } from "lucide-react";

interface Partner {
  id: string;
  name: string;
  name_ar: string;
  logo_url: string;
  website_url: string;
  display_order: number;
  is_active: boolean;
}

const AdminPartners = () => {
  const api=useCmsClient(); const {confirmDelete}=useCmsEditor(); const {can:canPermission}=useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    name_ar: "",
    logo_url: "",
    website_url: "",
    display_order: 0,
    is_active: true,
  });

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    setLoading(true);
    const { data, error } = await api
      .from("partners")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      toast({
        title: "Error loading partners",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setPartners(data || []);
    }
    setLoading(false);
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      errors.name = "Partner name is required";
    }

    if (!formData.logo_url.trim()) {
      errors.logo_url = "Partner logo is required";
    } else {
      // Validate logo URL format
      const logoUrl = formData.logo_url.trim();
      if (!logoUrl.startsWith('/') && !logoUrl.match(/^https?:\/\/.+/)) {
        errors.logo_url = "Logo URL must be a valid URL or start with /";
      }
    }

    if (formData.website_url && !formData.website_url.match(/^https?:\/\/.+/)) {
      errors.website_url = "Please enter a valid URL (starting with http:// or https://)";
    }

    if (formData.display_order < 0) {
      errors.display_order = "Display order must be 0 or greater";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors below",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      if (editingPartner) {
        // Update existing partner
        const { error } = await api
          .from("partners")
          .update(formData)
          .eq("id", editingPartner.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Partner updated successfully",
        });
      } else {
        // Create new partner
        const { error } = await api
          .from("partners")
          .insert([formData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Partner created successfully",
        });
      }

      setDialogOpen(false);
      resetForm();
      loadPartners();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      name_ar: partner.name_ar || "",
      logo_url: partner.logo_url,
      website_url: partner.website_url || "",
      display_order: partner.display_order,
      is_active: partner.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDelete("Are you sure you want to delete this partner?")) return;

    try {
      const { error } = await api
        .from("partners")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Partner deleted successfully",
      });
      loadPartners();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg','image/png','image/webp','image/gif','image/x-icon','image/vnd.microsoft.icon'].includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await api.storage
        .from('partner_logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = api.storage
        .from('partner_logos')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, logo_url: publicUrl }));

      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      name_ar: "",
      logo_url: "",
      website_url: "",
      display_order: 0,
      is_active: true,
    });
    setEditingPartner(null);
    setFormErrors({});
    setSaving(false);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    resetForm();
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-crm-primary-text">Partners Management</h2>
            <p className="text-muted-foreground mt-2">
              Manage partner companies displayed in the website footer
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Partner
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingPartner ? "Edit Partner" : "Add New Partner"}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Partner Name (English)</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (formErrors.name) {
                        setFormErrors({ ...formErrors, name: "" });
                      }
                    }}
                    placeholder="Partner Company Name"
                    className={formErrors.name ? "border-red-500" : ""}
                    required
                  />
                  {formErrors.name && (
                    <p className="text-sm text-red-500">{formErrors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name_ar">Partner Name (Arabic)</Label>
                  <Input
                    id="name_ar"
                    value={formData.name_ar}
                    onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                    placeholder="اسم الشركة الشريكة"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo">Partner Logo</Label>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploading}
                    />
                    <Button type="button" disabled={uploading} size="sm">
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.logo_url && (
                    <div className="mt-2">
                      <img
                        src={formData.logo_url}
                        alt="Logo preview"
                        className="h-16 w-auto object-contain border rounded"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website_url">Website URL</Label>
                  <Input
                    id="website_url"
                    type="url"
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    placeholder="https://partner-website.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_order">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} disabled={!canPermission('partners.publish')}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button cmsAction="write"
                    type="submit"
                    className="flex-1"
                    disabled={saving || uploading}
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {editingPartner ? "Updating..." : "Adding..."}
                      </>
                    ) : (
                      editingPartner ? "Save Changes" : "Add Partner"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDialogClose}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Current Partners
            </CardTitle>
          </CardHeader>
          <CardContent>
            {partners.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No partners added yet. Click "Add Partner" to get started.
              </div>
            ) : (
              <div className="grid gap-4">
                {partners.map((partner) => (
                  <div
                    key={partner.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={partner.logo_url}
                        alt={partner.name}
                        className="h-12 w-auto object-contain"
                      />
                      <div>
                        <h3 className="font-semibold">{partner.name}</h3>
                        {partner.name_ar && (
                          <p className="text-sm text-muted-foreground">{partner.name_ar}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-1 rounded ${
                            partner.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {partner.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Order: {partner.display_order}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {partner.website_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={partner.website_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={"Edit " + partner.name} onClick={() => handleEdit(partner)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={"Delete " + partner.name} onClick={() => handleDelete(partner.id)} cmsAction="delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminPartners;
