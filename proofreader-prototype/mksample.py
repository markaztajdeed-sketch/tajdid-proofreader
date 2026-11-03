import docx, zipfile, base64
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
d = docx.Document()
st = d.styles['Normal']; st.font.name='Arial'
def para(text_runs):
    p = d.add_paragraph()
    pPr = p._p.get_or_add_pPr(); b = OxmlElement('w:bidi'); pPr.append(b)
    for t, bold in text_runs:
        r = p.add_run(t); r.bold = bold
        rPr = r._r.get_or_add_rPr(); x = OxmlElement('w:rtl'); rPr.append(x)
    return p
para([("الحداثة وسؤال الهوية", True)])
para([("مازال سؤال الهوية حاضراً في الفكر العربي المعاصر ،ولابد من العودة إلى جذوره الأولى . فقد طرح الجابري هذا السؤال في كتابه (  بنية العقل العربي ) الصادر عام (1991م) .", False)])
para([("ويرى بعض الباحثين - ومنهم مفكرون من أفريقيا وآسيا - أن العلاقة بين الديني / الدنيوي هي ", False), ("المسألة  الرئيسية", True), (" في هذا النقاش، وهي تمتد بين 1950 - 1970 تقريباً .", False)])
para([("وقد قال النبي صلى الله عليه وآله: \" العلم خزائن ومفاتيحه السؤال \" (انظر ص 22.) ثم أشار الإمام علي عليه السلام إلى ذلك في أكثر من موضع.", False)])
para([("ونُشر المقال في 12 تموز 2015، وناقش ال Postmodernism بوصفها تياراً فكريّاً، والشّمس لا تُغطّى بغربال، وكان ذلك موقفًا مّا من الإيديولوجيا الليبيرالية.", False)])
para([("قال تعالى: ﴿إِنَّ اللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا مَا بِأَنفُسِهِمْ﴾ [الرعد: من الآية 11].", False)])
para([("وفي هذا السياق يمكن العودة إلى المصادر الأولى (كما في الهامش .", False)])
d.save('sample.docx')
print(len(open('sample.docx','rb').read()))
