
import axios from 'axios';

async function main() {
  try {
    const response = await axios.get('http://localhost:3000/stories/categories?language=vi');
    console.log('Categories found:');
    response.data.forEach((cat: any) => {
      console.log(`- ID: ${cat.id}, Name: ${cat.name}, Slug: ${cat.slug}`);
    });
  } catch (error) {
    console.error('Error fetching categories:', error.message);
  }
}

main();
