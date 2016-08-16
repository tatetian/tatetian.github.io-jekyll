module Jekyll
    class RenderTags < Liquid::Tag
        def initialize(tag_name, markup, options)
            super
            @text = markup
        end

        def render(context)
            tagsHtml = @text.split(",").map { |s| '<span class="tag">' + (s.strip || s) + '</span>' }
            '<p class="tags">' + tagsHtml.join(" ") + "</p>"
        end
    end
end

Liquid::Template.register_tag('tags', Jekyll::RenderTags)
