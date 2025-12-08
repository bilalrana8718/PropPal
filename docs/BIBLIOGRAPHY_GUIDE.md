# How to Add Bibliography to Your LaTeX Document

## Method 1: Using BibTeX (Traditional - Recommended for Thesis)

### Step 1: Create a .bib file
Create a file named `references.bib` (or `bibliography.bib`) in your project directory. I've created a sample `references.bib` file for you.

### Step 2: Add citations in your document
In your LaTeX document, cite references using:
```latex
\cite{langchain2023}           % For in-text citation: (Chase, 2023)
\citep{langchain2023}          % For parenthetical citation
\citet{langchain2023}          % For textual citation
```

### Step 3: Add bibliography commands
At the end of your document (or in your main.tex file), add:
```latex
\bibliographystyle{ieeetr}    % IEEE Transactions style (common for CS)
% Other styles: apa, acm, plain, unsrt, alpha
\bibliography{references}      % Name of your .bib file (without .bib extension)
```

### Step 4: Compile in correct order
1. `pdflatex your_document.tex`
2. `bibtex your_document` (without .tex extension)
3. `pdflatex your_document.tex`
4. `pdflatex your_document.tex` (run twice to resolve all references)

## Method 2: Using BibLaTeX (Modern Alternative)

### In your preamble, add:
```latex
\usepackage[style=ieee,backend=biber]{biblatex}
\addbibresource{references.bib}
```

### At the end of your document:
```latex
\printbibliography
```

### Compile:
1. `pdflatex your_document.tex`
2. `biber your_document`
3. `pdflatex your_document.tex`
4. `pdflatex your_document.tex`

## Common Bibliography Styles

- **ieeetr**: IEEE Transactions (common for Computer Science)
- **acm**: ACM style
- **apa**: APA style
- **plain**: Plain numbered style
- **unsrt**: Unsorted numbered style
- **alpha**: Alphabetic style

## Adding References to .bib File

Format for different types:

### Journal Article
```bibtex
@article{key2024,
    author = {Author Name},
    title = {Article Title},
    journal = {Journal Name},
    volume = {1},
    number = {1},
    pages = {1--10},
    year = {2024}
}
```

### Conference Paper
```bibtex
@inproceedings{key2024,
    author = {Author Name},
    title = {Paper Title},
    booktitle = {Conference Name},
    year = {2024},
    pages = {1--10}
}
```

### Book
```bibtex
@book{key2024,
    author = {Author Name},
    title = {Book Title},
    publisher = {Publisher Name},
    year = {2024}
}
```

### Website
```bibtex
@misc{key2024,
    author = {Author or Organization},
    title = {Page Title},
    year = {2024},
    url = {https://example.com},
    note = {Accessed: Month Day, Year}
}
```

## Tips

1. **Citation Keys**: Use descriptive keys like `langchain2023`, `mongodb2024`
2. **Multiple Authors**: Separate with `and`: `author = {Author1 and Author2}`
3. **URLs**: Use `url` field for web resources
4. **Compilation**: Always compile in the correct order (pdflatex → bibtex → pdflatex → pdflatex)


