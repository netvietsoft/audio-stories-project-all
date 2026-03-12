import CategoriesClient from "../CategoriesClient";

export const metadata = {
  title: "Explore Category",
};

export default function CategoryStoriesPage({ params }: { params: { slug: string } }) {
  return <CategoriesClient initialSlug={params.slug} />;
}
