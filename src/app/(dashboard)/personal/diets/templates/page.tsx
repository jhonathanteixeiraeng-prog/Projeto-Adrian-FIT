import { redirect } from 'next/navigation';

// A biblioteca de modelos fica na aba "Modelos" da lista de dietas.
export default function DietTemplatesIndexPage() {
    redirect('/personal/diets?tab=templates');
}
