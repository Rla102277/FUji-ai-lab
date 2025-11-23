import { FilmRecipe, RecipePack } from "../types";

const STORAGE_KEY = 'fujiraw_user_recipes';

export const saveRecipeToDb = (recipe: FilmRecipe): void => {
  try {
    const existing = getSavedRecipes();
    const updated = [...existing, recipe];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save recipe", e);
  }
};

export const getSavedRecipes = (): FilmRecipe[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as FilmRecipe[];
  } catch (e) {
    console.error("Failed to load recipes", e);
    return [];
  }
};

export const deleteRecipeFromDb = (id: string): void => {
    try {
        const existing = getSavedRecipes();
        const updated = existing.filter(r => r.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error("Failed to delete recipe", e);
    }
};

export const getUserRecipePack = (): RecipePack => {
    const recipes = getSavedRecipes();
    return {
        id: 'user-generated',
        name: 'My Custom Recipes',
        author: 'You',
        recipes: recipes
    };
};
