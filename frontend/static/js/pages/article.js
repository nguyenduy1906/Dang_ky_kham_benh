const articleId = new URLSearchParams(location.search).get("id") || "0";
const article = articlePreviews.find((item) => item.id === articleId);
const articleCategories = {
  activity: "Hoạt động bệnh viện",
  training: "Đào tạo và trao đổi chuyên môn",
  health: "Y học thường thức",
  professional: "Hoạt động chuyên môn",
};
if (!article) {
  document.title = "Không tìm thấy bài viết | NEU Medical";
  document.querySelector("#article-title").textContent = "Không tìm thấy bài viết";
  document.querySelector("#article-content").textContent = "Bài viết này không có trong danh sách tin tức hiện tại.";
  document.querySelector("#article-metadata").hidden = true;
  document.querySelector("#article-preview").hidden = true;
  document.querySelector("#article-author").hidden = true;
  document.querySelector("#related-news").hidden = true;
} else {
  document.title = `${article.title} | NEU Medical`;
  document.querySelector("#article-title").textContent = article.title;
  document.querySelector("#article-category").textContent = articleCategories[article.category];
  const content = document.querySelector("#article-content");
  article.paragraphs.forEach((text, index) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    if (index === 0) paragraph.className = "article-lead";
    content.append(paragraph);
  });
  const figure = document.createElement("figure");
  figure.className = "article-figure";
  const image = document.createElement("img");
  image.src = article.image;
  image.alt = article.title;
  const caption = document.createElement("figcaption");
  caption.textContent = "Ảnh minh họa từ thư viện giao diện NEU Medical";
  figure.append(image, caption);
  content.append(figure);

  let related = articlePreviews.filter((item) => item.category === article.category && item.id !== article.id);
  if (!related.length) {
    document.querySelector("#related-title").textContent = "Tin tức khác";
    related = articlePreviews.filter((item) => item.id !== article.id);
  }
  const makeLink = (item) => {
    const link = document.createElement("a");
    link.href = `article.html?id=${encodeURIComponent(item.id)}`;
    return link;
  };
  const first = related[0];
  const feature = makeLink(first);
  feature.className = "related-feature";
  const photo = document.createElement("img");
  photo.src = first.image;
  photo.alt = "";
  photo.loading = "lazy";
  const copy = document.createElement("div");
  copy.className = "related-feature-content";
  const category = document.createElement("small");
  category.textContent = articleCategories[first.category];
  const headline = document.createElement("h3");
  headline.textContent = first.title;
  copy.append(category, headline);
  feature.append(photo, copy);
  document.querySelector("#related-feature").append(feature);
  related.slice(1, 5).forEach((item) => {
    const link = makeLink(item);
    const headline = document.createElement("h3");
    headline.textContent = item.title;
    const date = document.createElement("span");
    date.textContent = "Bài viết minh họa";
    link.append(headline, date);
    document.querySelector("#related-list").append(link);
  });
}
