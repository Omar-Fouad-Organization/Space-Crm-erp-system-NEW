// Reused from Premium-website @ 080ea485; original fields and editing logic retained.
// ERP-local presentation, capability controls, scoped API, and isolated previews; no website providers/CSS.
import { useEffect, useState } from "react";
import {CmsEditorFrame as AdminLayout} from "@/cms/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {useCmsClient,useCmsEditor,Button,CmsHtmlPreview} from "@/cms/context";
import {useAuth} from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Save, X, BookOpen, Eye } from "lucide-react";

interface Blog {
  id: string;
  title: string;
  title_ar: string;
  slug: string;
  excerpt: string;
  excerpt_ar: string;
  content: string;
  content_ar: string;
  cover_image_url: string;
  author: string;
  author_ar: string;
  category: string;
  category_ar: string;
  is_published: boolean;
  published_date: string;
  created_at: string;
}

const AdminBlogs = () => {
  const api=useCmsClient(); const {confirmDelete}=useCmsEditor(); const {can:canPermission}=useAuth();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [currentBlog, setCurrentBlog] = useState<Partial<Blog>>({
    title: "",
    title_ar: "",
    slug: "",
    excerpt: "",
    excerpt_ar: "",
    content: "",
    content_ar: "",
    cover_image_url: "",
    author: "",
    author_ar: "",
    category: "",
    category_ar: "",
    is_published: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadBlogs();
  }, []);

  const loadBlogs = async () => {
    const { data, error } = await api
      .from("blogs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load blogs",
        variant: "destructive",
      });
    } else {
      setBlogs(data || []);
    }
    setLoading(false);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleSave = async () => {
    if (!currentBlog.title || !currentBlog.content) {
      toast({
        title: "Error",
        description: "Title and content are required",
        variant: "destructive",
      });
      return;
    }

    const slug = currentBlog.slug || generateSlug(currentBlog.title);
    const blogData = {
      ...currentBlog,
      slug,
      published_date: currentBlog.is_published ? (currentBlog.published_date || new Date().toISOString()) : null,
    };

    if (currentBlog.id) {
      // Update existing blog
      const { error } = await api
        .from("blogs")
        .update(blogData)
        .eq("id", currentBlog.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update blog",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Blog updated successfully",
        });
        setEditing(false);
        loadBlogs();
      }
    } else {
      // Create new blog
      const { error } = await api
        .from("blogs")
        .insert([blogData]);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create blog",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Blog created successfully",
        });
        setEditing(false);
        loadBlogs();
      }
    }
  };

  const handleEdit = (blog: Blog) => {
    setCurrentBlog(blog);
    setEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDelete("Are you sure you want to delete this blog?")) return;

    const { error } = await api
      .from("blogs")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete blog",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Blog deleted successfully",
      });
      loadBlogs();
    }
  };

  const handleNew = () => {
    setCurrentBlog({
      title: "",
      title_ar: "",
      slug: "",
      excerpt: "",
      excerpt_ar: "",
      content: "",
      content_ar: "",
      cover_image_url: "",
      author: "",
      author_ar: "",
      category: "",
      category_ar: "",
      is_published: false,
    });
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setCurrentBlog({});
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
            <h2 className="text-2xl font-semibold text-crm-primary-text">Blog Management</h2>
            <p className="text-muted-foreground mt-2">
              Create and manage blog posts in English and Arabic
            </p>
          </div>
          {!editing && (
            <Button cmsAction="create" onClick={handleNew} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              New Blog Post
            </Button>
          )}
        </div>

        {editing ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{currentBlog.id ? "Edit Blog Post" : "New Blog Post"}</span>
                <div className="flex gap-2">
                  <Button onClick={handleSave} size="sm" cmsAction="write">
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button onClick={handleCancel} variant="outline" size="sm">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Published Status */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-base font-semibold">Publish Blog</Label>
                  <p className="text-sm text-muted-foreground">
                    Make this blog post visible to visitors
                  </p>
                </div>
                <Switch
                  checked={currentBlog.is_published}
                  onCheckedChange={(checked) =>
                    setCurrentBlog({ ...currentBlog, is_published: checked })
                  } disabled={!canPermission('blogs.publish')}
                />
              </div>

              {/* English Content */}
              <div className="space-y-4 p-4 border-2 border-blue-200 rounded-lg">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">EN</span>
                  English Content
                </h3>

                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    value={currentBlog.title}
                    onChange={(e) => setCurrentBlog({ ...currentBlog, title: e.target.value })}
                    placeholder="Blog post title"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Slug (URL)</Label>
                  <Input
                    value={currentBlog.slug}
                    onChange={(e) => setCurrentBlog({ ...currentBlog, slug: e.target.value })}
                    placeholder="blog-post-url (auto-generated if empty)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Excerpt</Label>
                  <Textarea
                    value={currentBlog.excerpt}
                    onChange={(e) => setCurrentBlog({ ...currentBlog, excerpt: e.target.value })}
                    placeholder="Short description"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Content *</Label>
                  <Textarea
                    value={currentBlog.content}
                    onChange={(e) => setCurrentBlog({ ...currentBlog, content: e.target.value })}
                    placeholder="Full blog content"
                    rows={8}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Author</Label>
                    <Input
                      value={currentBlog.author}
                      onChange={(e) => setCurrentBlog({ ...currentBlog, author: e.target.value })}
                      placeholder="Author name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input
                      value={currentBlog.category}
                      onChange={(e) => setCurrentBlog({ ...currentBlog, category: e.target.value })}
                      placeholder="e.g., Sustainability"
                    />
                  </div>
                </div>
              </div>

              {/* Arabic Content */}
              <div className="space-y-4 p-4 border-2 border-green-200 rounded-lg">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">AR</span>
                  Arabic Content (العربية)
                </h3>

                <div className="space-y-2">
                  <Label>Title (العنوان)</Label>
                  <Input
                    value={currentBlog.title_ar}
                    onChange={(e) => setCurrentBlog({ ...currentBlog, title_ar: e.target.value })}
                    placeholder="عنوان المقال"
                    dir="rtl"
                    className="text-right"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Excerpt (المقتطف)</Label>
                  <Textarea
                    value={currentBlog.excerpt_ar}
                    onChange={(e) => setCurrentBlog({ ...currentBlog, excerpt_ar: e.target.value })}
                    placeholder="وصف قصير"
                    rows={3}
                    dir="rtl"
                    className="text-right"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Content (المحتوى)</Label>
                  <Textarea
                    value={currentBlog.content_ar}
                    onChange={(e) => setCurrentBlog({ ...currentBlog, content_ar: e.target.value })}
                    placeholder="محتوى المقال الكامل"
                    rows={8}
                    dir="rtl"
                    className="text-right"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Author (الكاتب)</Label>
                    <Input
                      value={currentBlog.author_ar}
                      onChange={(e) => setCurrentBlog({ ...currentBlog, author_ar: e.target.value })}
                      placeholder="اسم الكاتب"
                      dir="rtl"
                      className="text-right"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Category (الفئة)</Label>
                    <Input
                      value={currentBlog.category_ar}
                      onChange={(e) => setCurrentBlog({ ...currentBlog, category_ar: e.target.value })}
                      placeholder="مثال: الاستدامة"
                      dir="rtl"
                      className="text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Cover Image */}
              <div className="space-y-2">
                <Label>Cover Image URL</Label>
                <Input
                  value={currentBlog.cover_image_url}
                  onChange={(e) =>
                    setCurrentBlog({ ...currentBlog, cover_image_url: e.target.value })
                  }
                  placeholder="https://images.unsplash.com/..."
                />
                {currentBlog.cover_image_url && (
                  <div className="mt-2">
                    <img
                      src={currentBlog.cover_image_url}
                      alt="Cover preview"
                      className="w-full max-w-md h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>
            <CmsHtmlPreview html={currentBlog.content||""} arabic={currentBlog.content_ar||""}/>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {blogs.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-xl text-muted-foreground">No blog posts yet</p>
                  <Button cmsAction="create" onClick={handleNew} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Blog Post
                  </Button>
                </CardContent>
              </Card>
            ) : (
              blogs.map((blog) => (
                <Card key={blog.id} className="overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    {/* Cover Image */}
                    <div className="md:w-64 h-48 md:h-auto">
                      <img
                        src={blog.cover_image_url}
                        alt={blog.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Content */}
                    <CardContent className="flex-1 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={blog.is_published ? "default" : "secondary"}>
                              {blog.is_published ? (
                                <>
                                  <Eye className="h-3 w-3 mr-1" />
                                  Published
                                </>
                              ) : (
                                "Draft"
                              )}
                            </Badge>
                            <Badge variant="outline">{blog.category}</Badge>
                          </div>
                          <h3 className="text-xl font-semibold mb-2">{blog.title}</h3>
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {blog.excerpt}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            By {blog.author} • {new Date(blog.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <Button
                            aria-label={"Edit " + blog.title} onClick={() => handleEdit(blog)}
                            variant="outline"
                            size="sm"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            aria-label={"Delete " + blog.title} onClick={() => handleDelete(blog.id)}
                            variant="outline"
                            size="sm" cmsAction="delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Arabic Preview */}
                      {blog.title_ar && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm text-muted-foreground mb-1">Arabic Version:</p>
                          <p className="font-semibold text-right" dir="rtl">
                            {blog.title_ar}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminBlogs;
