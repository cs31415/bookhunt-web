import type { BookSummary } from '../../shared/types/book';
import type { PieSlice } from '../../shared/components/PieChart/PieChart';

export const bookWithCoverImage: BookSummary = {
  id: 1,
  slug: 'dune',
  title: 'Dune',
  authorName: 'Frank Herbert',
  authorSlug: 'frank-herbert',
  year: 1965,
  coverUrl: 'https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg',
  hue: '#6f7a55',
  rating: 4.5,
  source: 'catalog',
};

export const bookWithNoCover: BookSummary = {
  id: 2,
  slug: 'the-left-hand-of-darkness',
  title: 'The Left Hand of Darkness',
  authorName: 'Ursula K. Le Guin',
  authorSlug: 'ursula-k-le-guin',
  year: 1969,
  coverUrl: null,
  hue: '#4a6670',
  rating: 4,
  source: 'catalog',
};

export const bookWithLongTitle: BookSummary = {
  id: 3,
  slug: 'the-hitchhikers-guide-long',
  title: "The Hitchhiker's Guide to the Galaxy: A Trilogy in Five Parts",
  authorName: 'Douglas Adams',
  authorSlug: 'douglas-adams',
  year: 1979,
  coverUrl: null,
  hue: '#a8452f',
  rating: 5,
  source: 'catalog',
};

export const unratedBook: BookSummary = {
  id: 4,
  slug: 'unrated-book',
  title: 'An Unrated Catalog Book',
  authorName: 'Jane Doe',
  authorSlug: 'jane-doe',
  year: 2020,
  coverUrl: null,
  hue: '#8a5fa3',
  rating: null,
  source: 'catalog',
};

export const googleBooksBook: BookSummary = {
  id: 5,
  slug: 'google-books-result',
  title: 'Sapiens: A Brief History of Humankind',
  authorName: 'Yuval Noah Harari',
  authorSlug: 'yuval-noah-harari',
  year: 2011,
  coverUrl: null,
  hue: '#4f8a5b',
  rating: null,
  source: 'google_books',
};

export const gallerySlices: PieSlice[] = [
  { label: 'Queued', value: 5 },
  { label: 'Reading', value: 3 },
  { label: 'Finished', value: 9 },
  { label: 'Abandoned', value: 2 },
];
