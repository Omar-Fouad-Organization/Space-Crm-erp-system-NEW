// Reused from Premium-website @ 080ea485; original fields and editing logic retained.
// ERP-local presentation, capability controls, scoped API, and isolated previews; no website providers/CSS.
import { useEffect, useState } from "react";
import {CmsEditorFrame as AdminLayout} from "@/cms/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {useCmsClient,useCmsEditor,Button,CmsHtmlPreview} from "@/cms/context";
import {useAuth} from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon, Upload, Trash2, Edit, Eye, EyeOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Photo {
  id: string;
  photo_name: string;
  photo_url: string;
  photo_alt: string;
  page_location: string;
  section_name: string;
  display_order: number;
  is_active: boolean;
}

const AdminPhotos = () => {
  const api=useCmsClient(); const {confirmDelete}=useCmsEditor(); const {can:canPermission}=useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const [newPhoto, setNewPhoto] = useState({
    photo_name: "",
    photo_url: "",
    photo_alt: "",
    page_location: "home",
    section_name: "",
    display_order: 0,
  });

  const pages = [
    { value: "home", label: "Homepage" },
    { value: "about", label: "About" },
    { value: "exhibitors", label: "Exhibitors" },
    { value: "sponsors", label: "Sponsors" },
    { value: "sectors", label: "Sectors" },
    { value: "content", label: "Content & Talks" },
    { value: "visitors", label: "Visitors" },
    { value: "contact", label: "Contact" },
  ];

  const sections = {
    home: [
      { value: "hero", label: "Hero Section" },
      { value: "features", label: "Features Section" },
      { value: "sectors", label: "Sectors Section" },
      { value: "stats", label: "Statistics Section" },
      { value: "testimonials", label: "Testimonials Section" }
    ],
    about: [
      { value: "hero", label: "Hero Section" },
      { value: "mission", label: "Mission Section" },
      { value: "vision", label: "Vision Section" },
      { value: "values", label: "Values Section" },
      { value: "team", label: "Team Section" }
    ],
    exhibitors: [
      { value: "hero", label: "Hero Section" },
      { value: "benefits", label: "Benefits Section" },
      { value: "gallery", label: "Gallery Section" },
      { value: "packages", label: "Packages Section" },
      { value: "testimonials", label: "Testimonials Section" }
    ],
    visitors: [
      { value: "hero", label: "Hero Section" },
      { value: "gallery", label: "Gallery Section" },
      { value: "highlights", label: "Highlights Section" },
      { value: "schedule", label: "Schedule Section" }
    ],
    sponsors: [
      { value: "hero", label: "Hero Section" },
      { value: "benefits", label: "Benefits Section" },
      { value: "packages", label: "Packages Section" }
    ],
    sectors: [
      { value: "hero", label: "Hero Section" },
      { value: "overview", label: "Overview Section" }
    ],
    content: [
      { value: "hero", label: "Hero Section" },
      { value: "speakers", label: "Speakers Section" },
      { value: "schedule", label: "Schedule Section" }
    ],
    contact: [
      { value: "hero", label: "Hero Section" },
      { value: "office", label: "Office Section" },
      { value: "map", label: "Map Section" }
    ]
  };

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    setLoading(true);
    const { data, error } = await api
      .from("photos")
      .select("*")
      .order("page_location", { ascending: true })
      .order("display_order", { ascending: true });

    if (error) {
      toast({
        title: "Error loading photos",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setPhotos(data || []);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await api.storage
      .from("premium_photos")
      .upload(filePath, file);

    if (uploadError) {
      toast({
        title: "Upload failed",
        description: uploadError.message,
        variant: "destructive",
      });
      setUploading(false);
      return;
    }

    const { data } = api.storage.from("premium_photos").getPublicUrl(filePath);

    if (isEdit && editingPhoto) {
      setEditingPhoto({ ...editingPhoto, photo_url: data.publicUrl });
    } else {
      setNewPhoto({ ...newPhoto, photo_url: data.publicUrl });
    }

    toast({
      title: "Upload successful",
      description: "Photo uploaded successfully",
    });
    setUploading(false);
  };

  const handleAddPhoto = async () => {
    if (!newPhoto.photo_name || !newPhoto.photo_url) {
      toast({
        title: "Missing information",
        description: "Please provide photo name and URL",
        variant: "destructive",
      });
      return;
    }

    const { error } = await api
      .from("photos")
      .insert([{ ...newPhoto, is_active: true }]);

    if (error) {
      toast({
        title: "Error adding photo",
        description: error.message,
        variant: "destructive",
      });
    } else {
      console.log('✅ Photo added successfully:', newPhoto);
      toast({
        title: "Success",
        description: "Photo added successfully",
      });
      setNewPhoto({
        photo_name: "",
        photo_url: "",
        photo_alt: "",
        page_location: "home",
        section_name: "",
        display_order: 0,
      });
      loadPhotos();
    }
  };

  const handleUpdatePhoto = async () => {
    if (!editingPhoto) return;

    const { error } = await api
      .from("photos")
      .update({
        photo_name: editingPhoto.photo_name,
        photo_url: editingPhoto.photo_url,
        photo_alt: editingPhoto.photo_alt,
        page_location: editingPhoto.page_location,
        section_name: editingPhoto.section_name,
        display_order: editingPhoto.display_order,
        is_active: editingPhoto.is_active,
      })
      .eq("id", editingPhoto.id);

    if (error) {
      toast({
        title: "Error updating photo",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Photo updated successfully",
      });
      setEditingPhoto(null);
      loadPhotos();
    }
  };

  const handleDeletePhoto = async (id: string) => {
    if (!await confirmDelete("Are you sure you want to delete this photo?")) return;

    const { error } = await api
      .from("photos")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error deleting photo",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Photo deleted successfully",
      });
      loadPhotos();
    }
  };

  const togglePhotoActive = async (photo: Photo) => {
    const { error } = await api
      .from("photos")
      .update({ is_active: !photo.is_active })
      .eq("id", photo.id);

    if (error) {
      toast({
        title: "Error updating photo",
        description: error.message,
        variant: "destructive",
      });
    } else {
      loadPhotos();
    }
  };

  const getPhotosByPage = (page: string) => {
    return photos.filter((p) => p.page_location === page);
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
          <h2 className="text-2xl font-semibold text-crm-primary-text">Photo Management</h2>
          <p className="text-muted-foreground mt-2">
            Manage all photos across your premium website
          </p>
        </div>

        {/* Add New Photo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Add New Photo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Photo Name *</Label>
                <Input
                  value={newPhoto.photo_name}
                  onChange={(e) => setNewPhoto({ ...newPhoto, photo_name: e.target.value })}
                  placeholder="e.g., Hero Background"
                />
              </div>
              <div className="space-y-2">
                <Label>Page Location *</Label>
                <Select
                  value={newPhoto.page_location}
                  onValueChange={(value) => setNewPhoto({ ...newPhoto, page_location: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((page) => (
                      <SelectItem key={page.value} value={page.value}>
                        {page.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section Name *</Label>
                <Select
                  value={newPhoto.section_name}
                  onValueChange={(value) => setNewPhoto({ ...newPhoto, section_name: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections[newPhoto.page_location as keyof typeof sections]?.map((section) => (
                      <SelectItem key={section.value} value={section.value}>
                        {section.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={newPhoto.display_order}
                  onChange={(e) => setNewPhoto({ ...newPhoto, display_order: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Photo Alt Text</Label>
              <Input
                value={newPhoto.photo_alt}
                onChange={(e) => setNewPhoto({ ...newPhoto, photo_alt: e.target.value })}
                placeholder="Describe the image for accessibility"
              />
            </div>
            <div className="space-y-2">
              <Label>Upload Photo or Enter URL *</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, false)}
                  disabled={uploading}
                  className="flex-1"
                />
                <span className="text-muted-foreground self-center">or</span>
                <Input
                  value={newPhoto.photo_url}
                  onChange={(e) => setNewPhoto({ ...newPhoto, photo_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1"
                />
              </div>
              {newPhoto.photo_url && (
                <img
                  src={newPhoto.photo_url}
                  alt="Preview"
                  className="mt-2 h-32 w-auto rounded-lg object-cover"
                />
              )}
            </div>
            <Button onClick={handleAddPhoto} disabled={uploading} cmsAction="create">
              <Upload className="h-4 w-4 mr-2" />
              Add Photo
            </Button>
          </CardContent>
        </Card>

        {/* Photos by Page */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              All Photos ({photos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="home">
              <TabsList className="grid grid-cols-4 lg:grid-cols-8 mb-4">
                {pages.map((page) => (
                  <TabsTrigger key={page.value} value={page.value}>
                    {page.label} ({getPhotosByPage(page.value).length})
                  </TabsTrigger>
                ))}
              </TabsList>

              {pages.map((page) => (
                <TabsContent key={page.value} value={page.value}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getPhotosByPage(page.value).map((photo) => (
                      <Card key={photo.id} className={!photo.is_active ? "opacity-50" : ""}>
                        <CardContent className="p-4">
                          <img
                            src={photo.photo_url}
                            alt={photo.photo_alt}
                            className="w-full h-48 object-cover rounded-lg mb-3"
                          />
                          <div className="space-y-2">
                            <h3 className="font-semibold">{photo.photo_name}</h3>
                            <p className="text-sm text-muted-foreground">
                              Section: {photo.section_name || "N/A"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Order: {photo.display_order}
                            </p>
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label={"Edit " + photo.photo_name} cmsAction="edit" onClick={() => setEditingPhoto(photo)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label={"Toggle publication " + photo.photo_name} onClick={() => togglePhotoActive(photo)} cmsAction="publish"
                              >
                                {photo.is_active ? (
                                  <Eye className="h-4 w-4" />
                                ) : (
                                  <EyeOff className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                aria-label={"Delete " + photo.photo_name} onClick={() => handleDeletePhoto(photo.id)} cmsAction="delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {getPhotosByPage(page.value).length === 0 && (
                      <p className="text-muted-foreground col-span-full text-center py-8">
                        No photos for this page yet
                      </p>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Edit Photo Modal */}
        {editingPhoto && (
          <Card className="fixed inset-4 z-50 overflow-auto bg-background shadow-2xl">
            <CardHeader>
              <CardTitle>Edit Photo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Photo Name</Label>
                  <Input
                    value={editingPhoto.photo_name}
                    onChange={(e) =>
                      setEditingPhoto({ ...editingPhoto, photo_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Page Location</Label>
                  <Select
                    value={editingPhoto.page_location}
                    onValueChange={(value) =>
                      setEditingPhoto({ ...editingPhoto, page_location: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pages.map((page) => (
                        <SelectItem key={page.value} value={page.value}>
                          {page.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Section Name</Label>
                  <Select
                    value={editingPhoto.section_name}
                    onValueChange={(value) =>
                      setEditingPhoto({ ...editingPhoto, section_name: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections[editingPhoto.page_location as keyof typeof sections]?.map((section) => (
                        <SelectItem key={section.value} value={section.value}>
                          {section.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Display Order</Label>
                  <Input
                    type="number"
                    value={editingPhoto.display_order}
                    onChange={(e) =>
                      setEditingPhoto({
                        ...editingPhoto,
                        display_order: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Photo Alt Text</Label>
                <Input
                  value={editingPhoto.photo_alt}
                  onChange={(e) =>
                    setEditingPhoto({ ...editingPhoto, photo_alt: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Upload New Photo or Enter URL</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, true)}
                    disabled={uploading}
                    className="flex-1"
                  />
                  <span className="text-muted-foreground self-center">or</span>
                  <Input
                    value={editingPhoto.photo_url}
                    onChange={(e) =>
                      setEditingPhoto({ ...editingPhoto, photo_url: e.target.value })
                    }
                    className="flex-1"
                  />
                </div>
                {editingPhoto.photo_url && (
                  <img
                    src={editingPhoto.photo_url}
                    alt="Preview"
                    className="mt-2 h-48 w-auto rounded-lg object-cover"
                  />
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleUpdatePhoto} disabled={uploading} cmsAction="write">
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setEditingPhoto(null)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPhotos;
